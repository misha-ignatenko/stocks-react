Meteor.publish("allPickLists", function () {
    return PickLists.find();
});

Meteor.publish("allPickListItems", function () {
    return PickListItems.find();
});