import { HttpRequest } from '@azure/functions'
import { wrap, HTTPError, TableInsert, Response, JSONResponse } from '../utils/wrap'
interface CertificatePacked {
    network: string
    payload: any
    iv: string
    channel: string
}
function getParams(method: 'get', req: HttpRequest): { laterThan: Date; network: string; channel: string }
function getParams(method: 'post', req: HttpRequest): { cert: CertificatePacked }
function getParams(method: string, req: HttpRequest): any {
    const { channel, laterThan, network } = req.query
    if (!network) throw new HTTPError({ error: 'Missing parameters "network"' })
    if (method === 'get') {
        if (!channel) throw new HTTPError({ error: 'Missing parameters "channel"' })
        return { network, channel, laterThan: new Date(laterThan) }
    }

    let cert: CertificatePacked
    try {
        cert = JSON.parse(req.body)
        if (cert.iv && cert.network && cert.payload && cert.channel) {
            cert = { iv: cert.iv, network: cert.network, payload: cert.payload, channel: cert.channel }
        } else throw new Error('')
    } catch {
        throw new HTTPError({ error: 'Invalid certificate' })
    }
    return { network, channel, cert }
}
const Certificate = wrap<CertificatePacked>({
    async GET(context, req) {
        const data: CertificatePacked[] = [
            {
                channel: 'test',
                iv: 'test',
                network: 'localhost',
                payload: 'test',
            },
        ]
        for (const x of data) delete x.channel
        return new Response(new JSONResponse(data))
    },
    async POST(context, req) {
        const { cert } = getParams('post', req)
        return new Response(new TableInsert(cert, 'channel', 'iv'))
    },
})

export default Certificate
