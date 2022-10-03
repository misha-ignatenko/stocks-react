// correct `addedOn` date formats
RatingChanges.find(
    {
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

// correct `date` date formats
RatingChanges.find(
    {
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
