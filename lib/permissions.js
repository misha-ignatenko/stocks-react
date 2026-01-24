import { Meteor } from 'meteor/meteor';

Permissions = {
    isPremium() {
        const user = Meteor.user({fields: {premium: 1}});
        return !!user?.premium;
    },
};
