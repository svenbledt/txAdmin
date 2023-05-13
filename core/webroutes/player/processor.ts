import { DatabaseActionType, DatabasePlayerType } from "@core/components/PlayerDatabase/databaseTypes";
import PlayerlistManager from "@core/components/PlayerlistManager";
import { now } from "@core/extras/helpers";
import xssInstancer from '@core/extras/xss.js';
const xss = xssInstancer();

/**
 * Processes an action list and returns a templatization array.
 * @param {array} list
 * @returns {array} array of actions, or throws on error
 */
export const processActionList = (list: DatabaseActionType[]) => {
    if (!list) return [];

    let tsNow = now();
    return list.map((log) => {
        const out: any = {
            id: log.id,
            type: log.type,
            date: (new Date(log.timestamp * 1000)).toLocaleString(),
            reason: log.reason,
            author: log.author,
            revocationNotice: false,
            color: null,
            message: null,
            isRevoked: null,
            footerNote: null,
        };
        let actReference;
        if (log.playerName) {
            actReference = xss(log.playerName);
        } else {
            actReference = '<i>' + xss(log.ids.map((x) => x.split(':')[0]).join(', ')) + '</i>';
        }
        if (log.type == 'ban') {
            out.color = 'danger';
            out.message = `${xss(log.author)} BANNED ${actReference}`;
        } else if (log.type == 'warn') {
            out.color = 'warning';
            out.message = `${xss(log.author)} WARNED ${actReference}`;
        } else {
            out.color = 'secondary';
            out.message = `${xss(log.author)} ${log.type.toUpperCase()} ${actReference}`;
        }
        if (log.revocation.timestamp) {
            out.color = 'dark';
            out.isRevoked = true;
            const revocationDate = (new Date(log.revocation.timestamp * 1000)).toLocaleString();
            out.footerNote = `Revoked by ${log.revocation.author} on ${revocationDate}.`;
        }
        if (typeof log.expiration == 'number') {
            const expirationDate = (new Date(log.expiration * 1000)).toLocaleString();
            out.footerNote = (log.expiration < tsNow) ? `Expired at ${expirationDate}.` : `Expires at ${expirationDate}.`;
        }
        return out;
    });
}


/**
 * Processes an player list and returns a templatization array.
 * @param {array} list
 * @returns {array} array of players, or throws on error
 */
export const processPlayerList = (list: DatabasePlayerType[]) => {
    //Typescript stuff
    const playerlistManager = (globals.playerlistManager as PlayerlistManager);

    if (!list) return [];

    const activeLicenses = playerlistManager.getPlayerList()
        .map((p) => p.license)
        .filter(l => l);
    return list.map((p) => {
        return {
            name: p.displayName,
            license: p.license,
            joined: (new Date(p.tsJoined * 1000)).toLocaleString(),
            color: (activeLicenses.includes(p.license)) ? 'success' : 'dark',
        };
    });
}
