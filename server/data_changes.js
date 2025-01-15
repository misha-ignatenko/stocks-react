import { EJSON } from 'meteor/ejson';
import moment from 'moment-timezone';
import _ from 'underscore';
import { MongoInternals } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

/*
Utils.migrateAddedOnDate = (startDate, endDate) => {
    // correct `addedOn` date formats
    RatingChanges.find(
        {
            dateString: {$gt: startDate, $lte: endDate},
            addedOn: {$type: 2},
        },
        {
            limit: 5,
            fields: {
                addedOn: 1,
            },
        }
    ).forEach(ratingChange => {
        const correctDate = new Date(ratingChange.addedOn);
        console.log(ratingChange._id, ratingChange.addedOn, correctDate);

        RatingChanges.update(ratingChange._id, {$set: {addedOn: correctDate}});
    });
};

Utils.migrateDate = function (startDate, endDate) {
    // correct `date` date formats
    RatingChanges.find(
        {
            dateString: {$gt: startDate, $lte: endDate},
            date: {$type: 2},
        },
        {
            limit: 5,
            fields: {
                date: 1,
            },
        }
    ).forEach(ratingChange => {
        const correctDate = new Date(ratingChange.date);
        console.log(ratingChange._id, ratingChange.date, correctDate);

        RatingChanges.update(ratingChange._id, {$set: {date: correctDate}});
    });
};

// remove old `quote` field
Stocks.find({
    quote: {$exists: true},
}, {limit: 5}).forEach(s => {
    const keys = _.keys(s);

    if (!EJSON.equals(keys, ['_id'])) {
        console.log(s._id, keys);
    }

    Stocks.update(s._id, {$unset: {quote: 1}});
});
*/

/*
Utils.removePickListItems = function () {
    const driver = MongoInternals.defaultRemoteCollectionDriver();
    driver.mongo.db.dropCollection('pickListItems').then(result => {
        console.log('result: ', result);
    }).catch(error => {
        console.log('there was an error: ', error);
    });
};
// Utils.removePickListItems();

Utils.removeIndividualStocksAccess = () => {
    Meteor.users.find({
        individualStocksAccess: {$exists: true},
    }, {
        fields: {
            individualStocksAccess: 1,
            username: 1,
        },
    }).forEach(user => {
        console.log('user with individualStocksAccess', user);
        Meteor.users.update(user._id, {$unset: {individualStocksAccess: 1}});
    });
};
Utils.removeIndividualStocksAccess();

Utils.dropCollection = function (collectionName) {
    const driver = MongoInternals.defaultRemoteCollectionDriver();
    driver.mongo.db.dropCollection(collectionName).then(result => {
        console.log('collection dropped: ', result);
    }).catch(error => {
        console.log('there was an error while removing collection: ', error);
    });
};
// Utils.dropCollection('quandlDataPullErrors');

*/

// initialize `insertedDateStr`
EarningsReleases.find({
    insertedDateStr: {$exists: false},
    insertedDate: {$exists: true},

    reportSourceFlag: 1,

    reportDateNextFiscalQuarter: {
        $gte: 20240701,
        $lte: 20260101,
    },

}, {
    sort: {
        reportDateNextFiscalQuarter: -1,
    },
    limit: 10_000,
    fields: {
        insertedDate: 1,
        reportDateNextFiscalQuarter: 1,
    },
}).forEach(e => {
    const {
        insertedDate,
        _id,
        reportDateNextFiscalQuarter,
    } = e;
    const insertedDateStr = moment(insertedDate).format(Utils.dateFormat);
    console.log(_id, reportDateNextFiscalQuarter, insertedDateStr);

    EarningsReleases.update(_id, {$set: {
        insertedDateStr,
    }});
});
