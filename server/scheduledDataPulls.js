import cron from 'node-cron';
import _ from 'underscore';
import { Meteor } from 'meteor/meteor';
import { Utils } from '../lib/utils';
import { ServerUtils } from './utils';

async function importEarningsReleases() {
    await Meteor.callAsync('importData', [], 'earnings_releases_new', true);
}

Meteor.startup(function() {

    // skip data pull if dev env
    if (Meteor.isDevelopment) return;

    // 7am & 2pm utc
    cron.schedule('0 7,14 * * *', () => {
        console.log('Running: earnings releases');
        importEarningsReleases().catch(error => {
            console.error('Error in earnings releases cron:', error);
        });
    });

    const baseOptions = {
        advancePurchaseDays: 1,
        saleDelayInDays: 2,
        saleDelayInDaysFinal: 10,
        ratingChangesLookbackInDays: 500,
        isForecast: true,
        includeHistory: true,
        bizDaysLookbackForHistory: 1000,
        emailResults: true,
    };

    // every weekday at 14:30
    cron.schedule('30 14 * * 1-5', () => {
        console.log('Running: 1st job');
        Meteor.callAsync('getEarningsAnalysis', {
            startDate: Utils.businessAdd(Utils.todaysDate(), 1),
            endDate: Utils.businessAdd(Utils.todaysDate(), 2),
            ...baseOptions,
        }).catch(error => {
            console.error('Error in 1st job:', error);
        });
    });

    // every weekday at 15:00
    cron.schedule('0 15 * * 1-5', () => {
        console.log('Running: 2nd job');
        Meteor.callAsync('getEarningsAnalysis', {
            startDate: Utils.businessAdd(Utils.todaysDate(), -1),
            endDate: Utils.todaysDate(),
            ...baseOptions,
        }).catch(error => {
            console.error('Error in 2nd job:', error);
        });
    });

    console.log('Cron jobs initialized');

});

Meteor.methods({
    async importEarningsReleases()  {
        await ServerUtils.runPremiumCheck(this);
        await importEarningsReleases();
    },
});