import { check } from 'meteor/check';

Meteor.publish("settings", function () {
    return Settings.find({type: 'main'}, {fields: {type: 1, clientSettings: 1}});
});


// RatingScales publications
Meteor.publish("specificRatingScales", function(ratingScaleIdsArr) {
    check(ratingScaleIdsArr, [String]);

    return RatingScales.find({_id: {$in: ratingScaleIdsArr}}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
});
Meteor.publish("ratingScales", function() {
    console.log("inside ratingScales publication");
    return RatingScales.find({}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
});

Meteor.publish("getPortfolioById", function(portfId) {
    check(portfId, String);

    if (this.userId) {
        //portfolios that are either public or the user is owner
        return Portfolios.find(
            { _id: portfId, $or: [ {private: false}, {ownerId: this.userId} ] },
            {fields: {_id: 1, name: 1, researchFirmId: 1, ownerId: 1, private: 1, rolling: 1, lookback: 1, criteria: 1, criteriaType: 1}}
        );
    } else {
        return Portfolios.find({_id: portfId, private: false}, {fields: {_id: 1, name: 1}});
    }
});

Meteor.publish("portfolios", function() {
    if (this.userId) {
        // TODO: add logic here to also return portfolios that you have either view or edit access in PortfolioPermissions collection
        //portfolios that are either public or the user is owner
        return Portfolios.find(
            { $or: [ {private: false}, {ownerId: this.userId} ] },
            {fields: {_id: 1, name: 1, researchFirmId: 1, ownerId: 1, private: 1}}
            );
    } else {
        return Portfolios.find({private: false}, {fields: {_id: 1, name: 1}});
    }
});

Meteor.publish(null, function() {
    var _user = this.userId ? Meteor.users.find({_id: this.userId}, {fields: {_id: 1, username: 1, registered: 1, lastModified: 1, showDataImportsTab: 1}}) : null;
    return _user;
});
