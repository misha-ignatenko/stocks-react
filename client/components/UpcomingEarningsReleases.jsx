UpcomingEarningsReleases = React.createClass({

    mixins: [ReactMeteorData],

    getMeteorData() {
        var pickListsQuery = {

        };

        return {
            pickLists: PickLists.find(pickListsQuery, {sort: {pickListDate: -1}}).fetch(),
            pickListCount: PickLists.find().count(),
            currentUser: Meteor.user()
        }
    },
    testQuandl: function() {
        //TODO hide this!
        var _authToken = "";
        var _symbol = "BRCD";
        $.getJSON("https://www.quandl.com/api/v3/datasets/ZEA/" + _symbol + ".json?auth_token=" + _authToken, function(data) {
            console.log("column names: ", data.dataset.column_names);
            console.log("data: ", data.dataset.data[0]);
            $.each(data, function(key, val) {
                console.log("--------------");
                console.log(key);
                console.log(val);
                console.log("------------");
            })
        });
    },

    render() {

        return (
            <div className="container">
                { this.data.currentUser ? (
                    this.data.currentUser.registered ? (
                        <div>
                            upcoming earnings releases
                            <button onClick={this.testQuandl}>test quandl for AAPL</button>
                        </div>
                    ) : null
                ) : null}
            </div>
        );
    }
});