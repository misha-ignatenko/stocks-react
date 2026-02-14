import { Meteor } from 'meteor/meteor';

export const Permissions = {
    isPremium() {
        const user = Meteor.user({fields: {premium: 1}});
        return !!user?.premium;
    },
};
