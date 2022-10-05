import { EJSON } from 'meteor/ejson';
import _ from 'underscore';

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
