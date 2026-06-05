// aqGateApi.js
// Kapu DAO host-szintű API expose.

import {
	aqProtocolStoragePut, aqProtocolStorageGet, aqProtocolStorageDelete,
	aqProtocolStorageList, aqProtocolStorageRename,
} from "./aqStorage.js";
import { seedStore, seedExists, seedUnlock, seedActivate, getWalletAddresses } from "./aqKeyring.js";
import { teardownGateDao } from "./aqGateRender.js";

let _exposed = false;

export function exposeGateApi() {
	if (_exposed) return;
	const api = Object.freeze({
		protocolStorage: Object.freeze({
			put:    (name, patch) => aqProtocolStoragePut(name, patch),
			get:    (name) => aqProtocolStorageGet(name),
			delete: (name) => aqProtocolStorageDelete(name),
			list:   (prefix, options) => aqProtocolStorageList(prefix, options),
			rename: (from, to) => aqProtocolStorageRename(from, to),
		}),
		seed: Object.freeze({
			store:    (record)   => seedStore(record),
			exists:   ()         => seedExists(),
			unlock:   (password) => seedUnlock(password),
			activate: (raw)      => seedActivate(raw),
		}),
		wallet: Object.freeze({
			addresses: () => getWalletAddresses(),
		}),
		gate: Object.freeze({
			done: () => teardownGateDao(),
		}),
	});
	try {
		Object.defineProperty(window, "aqGateApi", {
			value: api,
			writable: false,
			configurable: false,
			enumerable: true,
		});
	} catch {
		window.aqGateApi = api;
	}
	_exposed = true;
}

