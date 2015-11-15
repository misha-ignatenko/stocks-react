Meteor.startup(function() {

    var _localDev = false;

    if (_localDev) {
        if (_.indexOf(_.pluck(Meteor.users.find().fetch(), "username"), "mignatenko") === -1) {
            console.log('creating mignatenko user');
            Accounts.createUser({
                username: "mignatenko",
                password: "mignatenko"
            });
        }
        var _mignatenkoUserId = Meteor.users.findOne({username: "mignatenko"})._id;
        console.log('mignatenko user id: ', _mignatenkoUserId);

        if (_.indexOf(_.pluck(Meteor.users.find().fetch(), "username"), "mignatenko1") === -1) {
            Accounts.createUser({
                username: "mignatenko1",
                password: "mignatenko1"
            });
        }
        var _mignatenko1UserId = Meteor.users.findOne({username: "mignatenko1"})._id;
        console.log('mignatenko1 user id: ', _mignatenko1UserId);

        Stocks.remove({});
        Stocks.insert({
            _id: "AAPL",
            usersWithAccess: [
                _mignatenkoUserId
            ]
        });
        Stocks.insert({
            _id: "SBUX",
            usersWithAccess: [
                _mignatenkoUserId,
                _mignatenko1UserId
            ]
        });
        Stocks.insert({
            _id: "MSFT",
            usersWithAccess: [
                _mignatenkoUserId
            ]
        });
        Stocks.insert({
            _id: "KR",
            usersWithAccess: [
                _mignatenko1UserId
            ]
        });
    }


});