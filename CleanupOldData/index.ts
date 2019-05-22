import { removeOldCertificates } from '../utils/query'
import { AzureFunction } from '@azure/functions'

const cleanupOldData: AzureFunction = function(context) {
    // Remove all certs created 32 days ago
    return removeOldCertificates(new Date(Date.now() - 1000 * 60 * 60 * 24 * 32), context)
}

export default cleanupOldData
