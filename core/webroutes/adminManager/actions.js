const modulename = 'WebServer:AdminManagerActions';
import { customAlphabet } from 'nanoid';
import dict51 from 'nanoid-dictionary/nolookalikes'
import got from '@core/extras/got.js';
import consts from '@core/extras/consts';
import consoleFactory from '@extras/console';
const console = consoleFactory(modulename);

//Helper functions
const nanoid = customAlphabet(dict51, 20);
const isUndefined = (x) => { return (typeof x === 'undefined'); };
const citizenfxIDRegex = /^\w[\w.-]{1,18}\w$/;
const discordIDRegex = /^\d{17,20}$/;
const nameRegex = citizenfxIDRegex;
const nameRegexDesc = 'up to 18 characters containing only letters, numbers and the characters \`_.-\`';
const dangerousPerms = ['all_permissions', 'manage.admins', 'console.write', 'settings.write'];


/**
 * Returns the output page containing the admins.
 * @param {object} ctx
 */
export default async function AdminManagerActions(ctx) {
    //Sanity check
    if (isUndefined(ctx.params.action)) {
        return ctx.utils.error(400, 'Invalid Request');
    }
    let action = ctx.params.action;

    //Check permissions
    if (!ctx.utils.testPermission('manage.admins', modulename)) {
        return ctx.send({
            type: 'danger',
            message: 'You don\'t have permission to execute this action.',
        });
    }

    //Delegate to the specific action handler
    if (action == 'add') {
        return await handleAdd(ctx);
    } else if (action == 'edit') {
        return await handleEdit(ctx);
    } else if (action == 'delete') {
        return await handleDelete(ctx);
    } else {
        return ctx.send({
            type: 'danger',
            message: 'Unknown action.',
        });
    }
};


/**
 * Handle Add
 * @param {object} ctx
 */
async function handleAdd(ctx) {
    //Sanity check
    if (
        typeof ctx.request.body.name !== 'string'
        || typeof ctx.request.body.citizenfxID !== 'string'
        || typeof ctx.request.body.discordID !== 'string'
        || isUndefined(ctx.request.body.permissions)
    ) {
        return ctx.utils.error(400, 'Invalid Request - missing parameters');
    }

    //Prepare and filter variables
    let name = ctx.request.body.name.trim();
    let password = nanoid();
    let citizenfxID = ctx.request.body.citizenfxID.trim();
    let discordID = ctx.request.body.discordID.trim();
    let permissions = (Array.isArray(ctx.request.body.permissions)) ? ctx.request.body.permissions : [];
    permissions = permissions.filter((x) => { return typeof x === 'string';});
    if (permissions.includes('all_permissions')) permissions = ['all_permissions'];


    //Validate name
    if (!nameRegex.test(name)) {
        return ctx.send({type: 'danger', markdown: true, message: `**Invalid username, it must follow the rule:**\n${nameRegexDesc}`});
    }

    //Validate & translate FiveM ID
    let citizenfxData = false;
    if (citizenfxID.length) {
        try {
            if (consts.validIdentifiers.fivem.test(citizenfxID)) {
                const id = citizenfxID.split(':')[1];
                const res = await got(`https://policy-live.fivem.net/api/getUserInfo/${id}`, {timeout: 6000}).json();
                if (!res.username || !res.username.length) {
                    return ctx.send({type: 'danger', message: 'Invalid CitizenFX ID1'});
                }
                citizenfxData = {
                    id: res.username,
                    identifier: citizenfxID,
                };
            } else if (citizenfxIDRegex.test(citizenfxID)) {
                const res = await got(`https://forum.cfx.re/u/${citizenfxID}.json`, {timeout: 6000}).json();
                if (!res.user || typeof res.user.id !== 'number') {
                    return ctx.send({type: 'danger', message: 'Invalid CitizenFX ID2'});
                }
                citizenfxData = {
                    id: citizenfxID,
                    identifier: `fivem:${res.user.id}`,
                };
            } else {
                return ctx.send({type: 'danger', message: 'Invalid CitizenFX ID3'});
            }
        } catch (error) {
            console.error(`Failed to resolve CitizenFX ID to game identifier with error: ${error.message}`);
        }
    }

    //Validate Discord ID
    let discordData = false;
    if (discordID.length) {
        if (!discordIDRegex.test(discordID)) return ctx.send({type: 'danger', message: 'Invalid Discord ID'});
        discordData = {
            id: discordID,
            identifier: `discord:${discordID}`,
        };
    }

    //Check for privilege escalation
    if (!ctx.session.auth.master && !ctx.session.auth.permissions.includes('all_permissions')) {
        const deniedPerms = permissions.filter((x) => !ctx.session.auth.permissions.includes(x));
        if (deniedPerms.length) {
            return ctx.send({
                type: 'danger',
                message: `You cannot give permissions you do not have:<br>${deniedPerms.join(', ')}`,
            });
        }
    }

    //Add admin and give output
    try {
        await globals.adminVault.addAdmin(name, citizenfxData, discordData, password, permissions);
        ctx.utils.logAction(`Adding admin '${name}'.`);
        return ctx.send({type: 'showPassword', password});
    } catch (error) {
        return ctx.send({type: 'danger', message: error.message});
    }
}


/**
 * Handle Edit
 * @param {object} ctx
 */
async function handleEdit(ctx) {
    //Sanity check
    if (
        typeof ctx.request.body.name !== 'string'
        || typeof ctx.request.body.citizenfxID !== 'string'
        || typeof ctx.request.body.discordID !== 'string'
        || isUndefined(ctx.request.body.permissions)
    ) {
        return ctx.utils.error(400, 'Invalid Request - missing parameters');
    }

    //Prepare and filter variables
    const name = ctx.request.body.name.trim();
    const citizenfxID = ctx.request.body.citizenfxID.trim();
    const discordID = ctx.request.body.discordID.trim();
    const editingSelf = (ctx.session.auth.username.toLowerCase() === name.toLowerCase());
    let permissions;
    if (!editingSelf) {
        if (Array.isArray(ctx.request.body.permissions)) {
            permissions = ctx.request.body.permissions.filter((x) => { return typeof x === 'string';});
            if (permissions.includes('all_permissions')) permissions = ['all_permissions'];
        } else {
            permissions = [];
        }
    } else {
        permissions = undefined;
    }

    //Validate & translate FiveM ID
    let citizenfxData = false;
    if (citizenfxID.length) {
        try {
            if (consts.validIdentifiers.fivem.test(citizenfxID)) {
                const id = citizenfxID.split(':')[1];
                const res = await got(`https://policy-live.fivem.net/api/getUserInfo/${id}`, {timeout: 6000}).json();
                if (!res.username || !res.username.length) {
                    return ctx.send({type: 'danger', message: '(ERR1) Invalid CitizenFX ID'});
                }
                citizenfxData = {
                    id: res.username,
                    identifier: citizenfxID,
                };
            } else if (citizenfxIDRegex.test(citizenfxID)) {
                const res = await got(`https://forum.cfx.re/u/${citizenfxID}.json`, {timeout: 6000}).json();
                if (!res.user || typeof res.user.id !== 'number') {
                    return ctx.send({type: 'danger', message: '(ERR2) Invalid CitizenFX ID'});
                }
                citizenfxData = {
                    id: citizenfxID,
                    identifier: `fivem:${res.user.id}`,
                };
            } else {
                return ctx.send({type: 'danger', message: '(ERR3) Invalid CitizenFX ID'});
            }
        } catch (error) {
            console.error(`Failed to resolve CitizenFX ID to game identifier with error: ${error.message}`);
        }
    }

    //Validate Discord ID
    let discordData = false;
    if (discordID.length) {
        if (!discordIDRegex.test(discordID)) return ctx.send({type: 'danger', message: 'Invalid Discord ID'});
        discordData = {
            id: discordID,
            identifier: `discord:${discordID}`,
        };
    }

    //Check if admin exists
    const admin = globals.adminVault.getAdminByName(name);
    if (!admin) return ctx.send({type: 'danger', message: 'Admin not found.'});

    //Check if editing an master admin
    if (!ctx.session.auth.master && admin.master) {
        return ctx.send({type: 'danger', message: 'You cannot edit an admin master.'});
    }

    //Check for privilege escalation
    if (permissions && !ctx.session.auth.master && !ctx.session.auth.permissions.includes('all_permissions')) {
        const deniedPerms = permissions.filter((x) => !ctx.session.auth.permissions.includes(x));
        if (deniedPerms.length) {
            return ctx.send({
                type: 'danger',
                message: `You cannot give permissions you do not have:<br>${deniedPerms.join(', ')}`,
            });
        }
    }

    //Add admin and give output
    try {
        await globals.adminVault.editAdmin(name, null, citizenfxData, discordData, permissions);
        ctx.utils.logAction(`Editing user '${name}'.`);
        return ctx.send({type: 'success', refresh: true});
    } catch (error) {
        return ctx.send({type: 'danger', message: error.message});
    }
}


/**
 * Handle Delete
 * @param {object} ctx
 */
async function handleDelete(ctx) {
    //Sanity check
    if (
        isUndefined(ctx.request.body.name)
        || typeof ctx.request.body.name !== 'string'
    ) {
        return ctx.utils.error(400, 'Invalid Request - missing parameters');
    }
    let name = ctx.request.body.name.trim();

    //Check if editing himself
    if (ctx.session.auth.username.toLowerCase() === name.toLowerCase()) {
        return ctx.send({type: 'danger', message: "You can't delete yourself."});
    }

    //Check if admin exists
    let admin = globals.adminVault.getAdminByName(name);
    if (!admin) return ctx.send({type: 'danger', message: 'Admin not found.'});

    //Check if editing an master admin
    if (admin.master) {
        return ctx.send({type: 'danger', message: 'You cannot delete an admin master.'});
    }

    //Delete admin and give output
    try {
        await globals.adminVault.deleteAdmin(name);
        ctx.utils.logAction(`Deleting user '${name}'.`);
        return ctx.send({type: 'success', refresh: true});
    } catch (error) {
        return ctx.send({type: 'danger', message: error.message});
    }
}
