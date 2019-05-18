import { AzureFunction, Context, HttpRequest } from '@azure/functions'

interface CertificateV1Packed {
    network: string
    payload: any
    iv: string
    channel: string
}
const Cert: AzureFunction = async function(context: Context, req: HttpRequest): Promise<CertificateV1Packed | void> {
    context.log('Cert req')
    const { channel, laterThan, network } = req.query

    if (channel) {
        context.res = {
            body: `Channel = ${channel}`,
        }
        const arr = (context.bindings.newCertificates = [] as CertificateV1Packed[])
        arr.push({
            channel: '12',
            iv: 'test iv',
            network: 'localhost',
            payload: 'payload',
            PartitionKey: 'Test',
            RowKey: (0).toString(),
            Name: 'Name ' + 0,
        } as any)
    } else {
        context.res = {
            status: 400,
            body: 'Select a channel.',
        }
    }
}

export default Cert
