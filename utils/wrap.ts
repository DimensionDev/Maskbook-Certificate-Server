import { Context, HttpRequest, HttpMethod, AzureFunction } from '@azure/functions'

export class HTTPError extends Error {
    constructor(message: { error: string }, public code = 400) {
        super(JSON.stringify(message))
    }
}
/**
 * Insert a new record into Storage Table
 */
export class TableInsert<T> {
    constructor(
        public data: T | T[],
        public partitionKeyBy: keyof T,
        public rowKeyBy: keyof T,
        public binding = '$data',
    ) {
        this.build_single = this.build_single.bind(this)
    }
    private build_single(obj: T) {
        return Object.assign(obj, { RowKey: obj[this.rowKeyBy], PartitionKey: obj[this.partitionKeyBy] })
    }
    build() {
        if (Array.isArray(this.data)) {
            if (this.binding === '$return')
                throw new Error('Azure function does not supports $return with multiple inserts')
            else return this.data.map(this.build_single)
        }
        return this.build_single(this.data)
    }
}
/**
 * Return a JSON object
 */
export class JSONResponse<T> {
    constructor(public data: T | T[] = {} as any, public code = 200) {}
}
type Actions<T> = JSONResponse<T> | TableInsert<T>
/**
 * Build a response for this request
 */
export class Response<T> {
    public actions: Actions<T>[] = []
    constructor(...actions: Actions<T>[]) {
        this.actions = actions
    }
}

type Fn<T> = (context: Context, req: HttpRequest) => Promise<T>
export function wrap<T>(funcs: { [key in HttpMethod]?: Fn<Response<T> | void> }): AzureFunction {
    return async (context: Context, req: HttpRequest) => {
        try {
            if (req.method === null) throw new HTTPError({ error: 'Unknown method' })
            const fn = funcs[req.method]
            if (!fn) throw new HTTPError({ error: 'Not implemented' }, 500)

            const result = (await fn(context, req)) || new Response(new JSONResponse())
            let returnValue = undefined

            for (const action of result.actions) {
                if (action instanceof TableInsert) {
                    if (action.binding === '$return') returnValue = action.build()
                    else context.bindings[action.binding] = action.build()
                } else if (action instanceof JSONResponse) {
                    context.res = {
                        status: action.code || 200,
                        body: JSON.stringify(action.data),
                    }
                } else throw new Error('Unknown response type')
            }
            return returnValue
        } catch (e) {
            if (!(e instanceof HTTPError)) context.log(e.message, e.stack)
            context.res = {
                status: e.code || 400,
                body: e.message,
            }
        }
    }
}
