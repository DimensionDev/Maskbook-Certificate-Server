import { TableService, TableQuery } from 'azure-storage'
import { CertificatePacked } from '../friendship-certificate'

function promisifiedQuery<T>(
    service: TableService,
    table: string,
    query: TableQuery,
    token: TableService.TableContinuationToken,
) {
    return new Promise<TableService.QueryEntitiesResult<T>>((resolve, reject) => {
        service.queryEntities<T>(
            table,
            query,
            token,
            {
                entityResolver(obj: any) {
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
export async function queryCertificates(queryBuilder: (query: TableQuery) => TableQuery) {
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
        )
        results = results.concat(entries)
        previousToken = continuationToken!
    } while (previousToken)
    return results.filter(x => x)
}
