const modulename = 'DynamicAds';
import xss from 'xss';
import defaultAds from '../../dynamicAds.json';
import got from '@core/extras/got.js';
import consoleFactory from '@extras/console';
const console = consoleFactory(modulename);


//Helper
const cleanAds = (ads) => {
    return ads.map((ad) => {
        if (ad.text) ad.text = xss(ad.text);
        return ad;
    });
};


export default class DynamicAds {
    constructor() {
        this.adIndex = {
            login: 0,
            main: 0,
        };
        this.adOptions = false;

        //Set default ads
        if (Array.isArray(defaultAds.login) && Array.isArray(defaultAds.main)) {
            this.adOptions = {
                login: cleanAds(defaultAds.login),
                main: cleanAds(defaultAds.main),
            };
        }

        //Update with the ads from the interweebs
        this.update();

        //Cron Function
        setInterval(() => {
            this.rotate();
        }, 60 * 1000);
    }


    //================================================================
    async update() {
        const indexURL = 'https://raw.githubusercontent.com/tabarra/txAdmin/master/dynamicAds.json';
        try {
            const res = await got(indexURL).json();
            if (Array.isArray(defaultAds.login) && Array.isArray(defaultAds.main)) {
                this.adOptions = {
                    login: cleanAds(res.login),
                    main: cleanAds(res.main),
                };
                this.adIndex = {
                    login: 0,
                    main: 0,
                };
            }
        } catch (error) {
            console.verbose.warn(`Failed to retrieve dynamic ads with error: ${error.message}`);
        }
    }


    //================================================================
    rotate() {
        if (!this.adOptions) return;
        this.adIndex.login = (this.adIndex.login + 1) % this.adOptions.login.length;
        this.adIndex.main = (this.adIndex.main + 1) % this.adOptions.main.length;
    }


    //================================================================
    pick(spot) {
        if (!this.adOptions) {
            return false;
        } else if (spot === 'login') {
            return (this.adOptions.login && this.adOptions.login.length)
                ? this.adOptions.login[this.adIndex.login]
                : false;
        } else if (spot === 'main') {
            return (this.adOptions.main && this.adOptions.main.length)
                ? this.adOptions.main[this.adIndex.main]
                : false;
        } else {
            throw new Error('unknown spot type');
        }
    }
};
