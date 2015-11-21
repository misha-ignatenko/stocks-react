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

    render() {

        return (
            <div className="container">
                { this.data.currentUser ? (
                    this.data.currentUser.registered ? (
                        <div>
                            upcoming earnings releases
                        </div>
                    ) : null
                ) : null}
            </div>
        );
    }
});