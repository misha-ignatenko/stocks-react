//TODO React is not defined
//var React = require('react-bootstrap');
var _mainTabName = "mainTab";
var _individualStockTabName = "individualStockTab";
var _upcomingEarningsReleasesTabName = "upcomingEarningsReleases";
var _dataImportsTabName = "dataImportsTab";

StocksApp = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            tabNameToShow: _mainTabName
        }
    },

    getMeteorData() {
        let pickListsQuery = {

        };

        return {
            pickLists: PickLists.find(pickListsQuery, {sort: {pickListDate: -1}}).fetch(),
            currentUser: Meteor.user()
        }
    },

    renderPickLists() {
        return this.data.pickLists.map((pickList) => {
            const currentUserId = this.data.currentUser && this.data.currentUser._id;
            const showPrivateButton = pickList.addedBy === currentUserId;

            return <PickList
                key={pickList._id}
                pickList={pickList}
                showPrivateButton={showPrivateButton} />;
        });
    },

    handleSubmitPickList(event) {
        event.preventDefault();
        var pickListName = React.findDOMNode(this.refs.textInput).value.trim();
        //TODO change new Date() below
        var pickListDate = new Date();
        var stocksList = [];


        //todo add more stuff here because a pick list is much more than just a name
        //TODO should be able to add new pick lists manually from client side as well as mass import using data

        Meteor.call("addPickList", pickListName, pickListDate, stocksList);
        React.findDOMNode(this.refs.textInput).value = "";
    },

    selectTab(e) {
        let _clickedTabName = $(e.target).attr("id");
        this.setState({
            tabNameToShow: _clickedTabName
        });
    },

    render() {
        //add this to tabs to make router work
        //<li className="tab3"><a href="/dataimport/updowngrades">TEST TO UP DOWN GRADES</a></li>
        let _b = "btn btn-default";
        let _ab = "btn btn-default active";
        return (
            <div className="container">
                <header>
                    <AccountsUIWrapper />
                </header>

                <div className="btn-group" role="group" aria-label="...">
                    <button type="button" className={this.state.tabNameToShow === _mainTabName ? _ab : _b} id={_mainTabName} onClick={this.selectTab}>Portfolios</button>
                    <button type="button" className={this.state.tabNameToShow === _individualStockTabName ? _ab : _b} id={_individualStockTabName} onClick={this.selectTab}>Individual Stocks</button>
                    <button type="button" className={this.state.tabNameToShow === _upcomingEarningsReleasesTabName ? _ab : _b} id={_upcomingEarningsReleasesTabName} onClick={this.selectTab}>Upcoming Earnings Releases</button>
                    <button type="button" className={this.state.tabNameToShow === _dataImportsTabName ? _ab : _b} id={_dataImportsTabName} onClick={this.selectTab}>Data Imports</button>
                </div>

                { this.state.tabNameToShow === _mainTabName ? (
                    <div>
                        <br/>
                        { this.data.currentUser ?
                            <form className="new-pickList" onSubmit={this.handleSubmitPickList} >
                                <input
                                    type="text"
                                    ref="textInput"
                                    placeholder="Type to add new pick lists" />
                            </form> : ''
                        }
                        <br/>
                        <br/>
                        {this.renderPickLists()}
                        <br/>
                    </div>
                ) : null}
                { this.state.tabNameToShow === _individualStockTabName ? (
                    <div>
                        <IndividualStock />
                    </div>
                ) : null}
                { this.state.tabNameToShow === _upcomingEarningsReleasesTabName ? (
                    <div>
                        <UpcomingEarningsReleases />
                    </div>
                ) : null}
                { this.state.tabNameToShow === _dataImportsTabName ? (
                    <div>
                        <DataImportsMain />
                    </div>
                ) : null}
            </div>
        );
    }
});