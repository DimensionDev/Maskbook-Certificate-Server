import { HttpRequest } from '@azure/functions'
import { wrap, HTTPError, TableInsert, Response, JSONResponse } from '../utils/wrap'
import { queryCertificates } from '../utils/query'
export interface CertificatePacked {
    network: string
    payload: string
    iv: string
    channel: string
    cryptoKey: JsonWebKey
}
const doc = `
/friendship-certificate:
# GET
query network: indicates which network do you want to receive
query channel: indicates which channel do you want to receive
query laterThan (optional): only receive certs newer than a time

# POST
body: a CertificatePacked object
`
function isString(...args: any[]) {
    return args.every(x => typeof x === 'string' && x.length <= 100)
}
function isK256JsonWebKey(x: JsonWebKey): x is JsonWebKey {
    return !!(
        typeof x === 'object' &&
        x.kty === 'EC' &&
        x.x &&
        x.x.length === 43 &&
        x.y &&
        x.y.length === 43 &&
        x.crv === 'K-256' &&
        typeof x.ext === 'boolean' &&
        Array.isArray(x.key_ops) &&
        x.key_ops.join().length < 20
    )
}
function getParams(method: 'get', req: HttpRequest): { laterThan: Date; network: string; channel: string }
function getParams(method: 'post', req: HttpRequest): { cert: CertificatePacked }
function getParams(method: string, req: HttpRequest): any {
    const { channel, laterThan, network } = req.query
    if (method === 'get') {
        if (!channel || !network) throw new HTTPError({ error: 'Missing parameters "channel"', doc })
        return { network, channel, laterThan: new Date(laterThan || 0) }
    } else if (method === 'post') {
        let cert: CertificatePacked
        try {
            cert = req.body
            if (isString(cert.channel, cert.iv, cert.iv, cert.payload) && isK256JsonWebKey(cert.cryptoKey)) {
                cert = {
                    iv: cert.iv,
                    network: cert.network,
                    payload: cert.payload,
                    channel: cert.channel,
                    cryptoKey: cert.cryptoKey,
                }
            } else throw new Error('')
        } catch {
            throw new HTTPError({ error: 'Invalid certificate', doc })
        }
        return { network, channel, cert }
    } else throw new TypeError('Unknown method')
}
const Certificate = wrap<CertificatePacked>({
    async GET(context, req) {
        const { channel, laterThan, network } = getParams('get', req)
        // PartitionKey eq 'channel'
        // and Timestamp ge datetime'2019-04-20T07:26:14.171Z'
        // and network eq 'utopia@mastodon'
        const data = await queryCertificates(query =>
            query
                .where('PartitionKey == ?string?', channel)
                .and('network == ?string?', network)
                .and('Timestamp >= ?date?', laterThan),
        )
        for (const x of data) {
            delete x.channel
            delete x.network
        }
        return new Response(new JSONResponse(data))
    },
    async POST(context, req) {
        const { cert } = getParams('post', req)
        return new Response(new TableInsert(cert, 'channel', 'iv'))
    },
})

export default Certificate
