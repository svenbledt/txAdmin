const modulename = 'WebServer:AuthGet';
import chalk from 'chalk';
import consoleFactory from '@extras/console';
const console = consoleFactory(modulename);


//Helper functions
const isUndefined = (x) => { return (typeof x === 'undefined'); };

/**
 * Gets the login page and destroys session if /auth?logout is defined
 * @param {object} ctx
 */
export default async function AuthGet(ctx) {
    //Set template type
    let template;
    if (globals.adminVault.admins === false) {
        template = 'noMaster';
        if (globals.adminVault.addMasterPin) {
            console.log('Use this PIN to add a new master account: ' + chalk.inverse(` ${globals.adminVault.addMasterPin} `));
        }
    } else {
        template = 'normal';
    }

    //Destroy session? And start a new one
    if (!isUndefined(ctx.query.logout)) ctx.session.auth = {};

    //If admins file was deleted
    if (Array.isArray(globals.adminVault.admins) && !globals.adminVault.admins.length) {
        return ctx.utils.render('login', {
            template: 'justMessage',
            errorTitle: 'No admins configured.',
            errorMessage: 'This likely means that you moved or deleted the admins.json file. Please restart txAdmin to configure a new master account.',
        });
    }

    //Render page
    const renderData = {
        template,
        message: (!isUndefined(ctx.query.logout)) ? 'Logged Out' : '',
        citizenfxDisabled: !globals.adminVault.providers.citizenfx.ready,
    };
    return ctx.utils.render('login', renderData);
};
