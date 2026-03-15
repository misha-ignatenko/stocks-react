import { EJSON } from "meteor/ejson";
import moment from "moment-timezone";
import _ from "underscore";
import { Meteor } from "meteor/meteor";
import { Utils } from "../lib/utils";
import { ServerUtils } from "./utils";
import { RatingChanges, EarningsReleases, Stocks } from "../lib/collections";

ServerUtils.migrateAddedOnDate = (startDate, endDate) => {
    // correct `addedOn` date formats
    RatingChanges.find(
        {
            dateString: { $gt: startDate, $lte: endDate },
            addedOn: { $type: 2 },
        },
        {
            limit: 5,
            fields: {
                addedOn: 1,
            },
        },
    ).forEach((ratingChange) => {
        const correctDate = new Date(ratingChange.addedOn);
        console.log(ratingChange._id, ratingChange.addedOn, correctDate);

        RatingChanges.update(ratingChange._id, {
            $set: { addedOn: correctDate },
        });
    });
};

ServerUtils.migrateDate = function (startDate, endDate) {
    // correct `date` date formats
    RatingChanges.find(
        {
            dateString: { $gt: startDate, $lte: endDate },
            date: { $type: 2 },
        },
        {
            limit: 5,
            fields: {
                date: 1,
            },
        },
    ).forEach((ratingChange) => {
        const correctDate = new Date(ratingChange.date);
        console.log(ratingChange._id, ratingChange.date, correctDate);

        RatingChanges.update(ratingChange._id, { $set: { date: correctDate } });
    });
};

/*
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

ServerUtils.removePickListItems = function () {
    ServerUtils.dropCollection("pickListItems");
};
// ServerUtils.removePickListItems();

ServerUtils.removeIndividualStocksAccess = () => {
    Meteor.users
        .find(
            {
                individualStocksAccess: { $exists: true },
            },
            {
                fields: {
                    individualStocksAccess: 1,
                    username: 1,
                },
            },
        )
        .forEach((user) => {
            console.log("user with individualStocksAccess", user);
            Meteor.users.update(user._id, {
                $unset: { individualStocksAccess: 1 },
            });
        });
};
// ServerUtils.removeIndividualStocksAccess();

// ServerUtils.dropCollection('quandlDataPullErrors');

/*
// initialize `insertedDateStr`
Meteor.defer(() => {
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
});
*/
