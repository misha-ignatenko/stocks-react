//TODO React is not defined
//var React = require('react-bootstrap');

StocksApp = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            showMainTab: true,
            individualStockTab: false,
            showUpcomingEarningsReleasesTab: false,
            showDataImportsTab: false
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
        let _showMainTab = e.target.getAttribute("data-tag") === "mainTab";
        let _showIndividualStockTab = e.target.getAttribute("data-tag") === "individualStockTab";
        let _showUpcomingEarningsReleasesTab = e.target.getAttribute("data-tag") === "upcomingEarningsReleases";
        let _showDataImportsTab = e.target.getAttribute("data-tag") === "dataImportsTab";
        this.setState({
            showMainTab: _showMainTab,
            individualStockTab: _showIndividualStockTab,
            showUpcomingEarningsReleasesTab: _showUpcomingEarningsReleasesTab,
            showDataImportsTab: _showDataImportsTab
        });
    },

    render() {
        //add this to tabs to make router work
        //<li className="tab3"><a href="/dataimport/updowngrades">TEST TO UP DOWN GRADES</a></li>
        return (
            <div className="container">
                <header>
                    <AccountsUIWrapper />
                </header>

                <ul className="nav nav-tabs">
                    <li className="tab1"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="mainTab">Stock Lists</a></li>
                    <li className="tab2"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="individualStockTab">Individual Stocks</a></li>
                    <li className="tab3"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="upcomingEarningsReleases">Upcoming Earnings Releases</a></li>
                    <li className="tab3"><a href="javascript:void(0)" onClick={this.selectTab} data-tag="dataImportsTab">Data Imports</a></li>
                </ul>
                { this.state.showMainTab ? (
                    <div>
                        { this.data.currentUser ?
                            <form className="new-pickList" onSubmit={this.handleSubmitPickList} >
                                <input
                                    type="text"
                                    ref="textInput"
                                    placeholder="Type to add new pick lists" />
                            </form> : ''
                        }
                        {this.renderPickLists()}
                        <br/>
                    </div>
                ) : null}
                { this.state.individualStockTab ? (
                    <div>
                        <IndividualStock />
                    </div>
                ) : null}
                { this.state.showUpcomingEarningsReleasesTab ? (
                    <div>
                        <UpcomingEarningsReleases />
                    </div>
                ) : null}
                { this.state.showDataImportsTab ? (
                    <div>
                        <DataImportsMain />
                    </div>
                ) : null}
            </div>
        );
    }
});