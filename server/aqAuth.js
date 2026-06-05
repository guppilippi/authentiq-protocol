import { verifyMessage } from "ethers";

const SKEW = 5 * 60 * 1000;

export function checkTimestamp(ts) {
	const t = Number(ts);
	return Number.isFinite(t) && Math.abs(Date.now() - t) <= SKEW;
}

export function recoverWallet(message, sig) {
	try { return verifyMessage(message, sig).toLowerCase(); }
	catch { return null; }
}

export const msgMintToken    = (ts)               => `aqMintToken:${ts}`;
export const msgSetSwarmHash = (tokenId, cid, ts) => `aqSetSwarmHash:${tokenId}:${cid}:${ts}`;
export const msgUploadAsset  = (ts)               => `aqUploadAsset:${ts}`;
