import { Meteor } from 'meteor/meteor';

export const Permissions = {
    async isPremium() {
        const user = await Meteor.userAsync({fields: {premium: 1}});
        return !!user?.premium;
    },
};
