import { check } from "meteor/check";
import { Meteor } from "meteor/meteor";
import { Settings, RatingScales } from "../lib/collections";

Meteor.publish("settings", function () {
    return Settings.find(
        { type: "main" },
        { fields: { type: 1, clientSettings: 1 } },
    );
});

// RatingScales publications
Meteor.publish("specificRatingScales", function (ratingScaleIdsArr) {
    check(ratingScaleIdsArr, [String]);

    return RatingScales.find(
        { _id: { $in: ratingScaleIdsArr } },
        { fields: { _id: 1, universalScaleValue: 1, researchFirmId: 1 } },
    );
});

Meteor.publish(null, function () {
    var _user = this.userId
        ? Meteor.users.find(
              { _id: this.userId },
              {
                  fields: {
                      _id: 1,
                      username: 1,
                      registered: 1,
                      premium: 1,
                      lastModified: 1,
                      showDataImportsTab: 1,
                  },
              },
          )
        : null;
    return _user;
});
