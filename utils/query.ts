import { TableService, TableQuery } from 'azure-storage'
import { CertificatePacked } from '../friendship-certificate'
import { Context } from '@azure/functions'

function promisifiedQuery<T>(
    service: TableService,
    table: string,
    query: TableQuery,
    token: TableService.TableContinuationToken,
    raw: boolean,
) {
    return new Promise<TableService.QueryEntitiesResult<T>>((resolve, reject) => {
        service.queryEntities<T>(
            table,
            query,
            token,
            {
                entityResolver(obj: any) {
                    if (raw) return obj
                    try {
                        return {
                            timestamp: new Date(obj.Timestamp._),
                            iv: obj.RowKey._,
                            payload: obj.payload._,
                            cryptoKey: JSON.parse(obj.cryptoKey._),
                        }
                    } catch {
                        return undefined!
                    }
                },
            },
            (err, data) => {
                if (err) return reject(err)
                resolve(data)
            },
        )
    })
}
export async function queryCertificates(queryBuilder: (query: TableQuery) => TableQuery, raw = false) {
    const azure = require('azure-storage') as typeof import('azure-storage')
    const tableService = azure.createTableService(process.env.AzureWebJobsStorage!)
    const query = queryBuilder(new azure.TableQuery())

    let previousToken: TableService.TableContinuationToken = undefined!
    let results: (CertificatePacked & { RowKey?: string; PartitionKey?: string })[] = []
    do {
        const { continuationToken, entries } = await promisifiedQuery<CertificatePacked>(
            tableService,
            'certificates',
            query,
            previousToken,
            raw,
        )
        results = results.concat(entries)
        previousToken = continuationToken!
    } while (previousToken)
    return results.filter(x => x)
}

export async function removeOldCertificates(beforeThan: Date, context: Context) {
    // Query all objects
    const outdated: Record<string, any>[] = await queryCertificates(
        query => query.where('Timestamp <= ?date?', beforeThan),
        true,
    )
    // Group them by PartitionKey
    const map: Record<string, any[]> = {}
    for (const each of outdated) {
        const key: string = each.PartitionKey._
        if (!map[key]) map[key] = []
        map[key].push(each)
    }
    // Patch delete by PartitionKey
    const azure = require('azure-storage') as typeof import('azure-storage')
    const tableService = azure.createTableService(process.env.AzureWebJobsStorage!)
    for (const [key, entries] of Object.entries(map)) {
        const batch = new azure.TableBatch()
        entries.forEach(batch.deleteEntity.bind(batch))
        tableService.executeBatch('certificates', batch, err => {
            if (err) throw err
            else context.log(`Clean ${entries.length} record(s) from partition ${key}`)
        })
    }
}
