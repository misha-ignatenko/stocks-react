IndividualStock = React.createClass({
    mixins: [ReactMeteorData],

    getMeteorData() {
        let _user = Meteor.user();
        return {
            currentUser: _user
            , allStockNames: Meteor.subscribe("allStockNames").ready() && Stocks.find().fetch()
        }
    },
    getInitialState: function()
    {
        return ({
            individualStockStartDate: null,
            individualStockEndDate: null,
            individualStockSearchResults: [],
            selectedStock: null,
            stocksToGraphObjects: [],
            showRegisterNewAccountFields: false,
            showRegisterAccountBtn: true
            , showAvgRatings: true
            , showWeightedRating: true
        });
    },

    componentWillMount: function() {
        if (_.isNull(Meteor.user())) {
            var _username = Random.id() + "@ign-stocks.com";
            var _password = Random.id();
            Accounts.createUser({
                username: _username,
                password: _password,
                registered: false
            });
        }
    },
    searchingStock: function() {
        $("#individualStockSearch").val($("#individualStockSearch").val().toUpperCase());
        let _arrayOfStockSymbolsAvailable = this.data.currentUser.individualStocksAccess ? this.data.currentUser.individualStocksAccess : [];
        let _searchCandidates = _arrayOfStockSymbolsAvailable.filter(function(symbol) {
            if ($("#individualStockSearch").val() && symbol.search($("#individualStockSearch").val()) > -1) {
                return true;
            }
            return false;
        })
        //TODO get rid of non-letter charachers (except for . -- allowed)
        this.setState({
            individualStockSearchResults: _searchCandidates
        });
    },
    renderSearchResults: function() {
        return (this.state.selectedStock || this.state.individualStockSearchResults.length > 0) ? this.state.individualStockSearchResults.map((symbol) => {
            return <button key={symbol} onClick={this.setSelectedStock.bind(this, symbol)}>{symbol}</button>;
        }) : null;
    },
    setSelectedStock: function(key) {
        $("#individualStockSearch").val(key);
        this.setState({
            selectedStock: key,
            individualStockSearchResults: []
        });
    },
    clearSelectedStock: function() {
        this.setState({
            selectedStock: null,
            individualStockSearchResults: []
        });
        $("#individualStockSearch").val("");
    },
    resetDateRange: function() {
        $("#individualStockStartDate").val("");
        $("#individualStockEndDate").val("");
        this.setState({
            individualStockStartDate: null,
            individualStockEndDate: null
        });
    },

    //TODO: add alert to prevent user from adding too many stocks

    selectFirstSearchResult: function(event) {
        if (event.keyCode === 13) {
            //this.setSelectedStock(this.state.individualStockSearchResults[0]);
            var _that = this;
            if ($("#individualStockSearch").val()) {
                //call yahoo to verify symbol
                Meteor.call("getLatestAskPrice", $("#individualStockSearch").val(), function (error, result) {
                    if (!error && result && result[0] && result[0].name) {
                        Meteor.call("addIndividualStockToUser", Meteor.userId(), result[0].symbol)
                        _that.setSelectedStock(result[0].symbol);
                    } else {
                        console.log("ask user to re-enter symbol");
                        _that.clearSelectedStock();
                    }
                });
            }
        }
    },
    showRegisterAccountFields: function() {
        this.setState({
            showRegisterNewAccountFields: true,
            showRegisterAccountBtn: false
        });
    },
    hideRegisterAccountFields: function() {
        this.setState({
            showRegisterNewAccountFields: false,
            showRegisterAccountBtn: true
        });
    },
    registerDummyUser: function() {
        var _newUsername = React.findDOMNode(this.refs.fromDummyToReal_username).value.trim();
        var _newPassword = React.findDOMNode(this.refs.fromDummyToReal_password).value.trim().toString();
        if (_newUsername && _newPassword) {
            var _that = this;
            Meteor.call("registerRealAccountFromDummy", _newUsername, _newPassword, function(error, result) {
                //make sure that dummy account was deleted and that you are logged in with the new real account credentials
                //empty out fields and hide that menu
                if (!error && result) {
                    Meteor.loginWithPassword(result.username, result.password);
                    //_that.hideRegisterAccountFields();
                }
            });
        }
    },

    selectTab: function(e) {
        let _clickedTabId = $(e.target).attr("id");

        this.setState({
            showAvgRatings: _clickedTabId === 'wgt' ? false : true,
            showWeightedRating: _clickedTabId === 'avg' ? false : true
        });
    },

    render: function() {
        let _b = "btn btn-default";
        let _ab = "btn btn-default active";

        return (
            <div className="container">
                { this.data.currentUser ? <div>
                    {this.data.currentUser.registered ? null :  (this.state.showRegisterAccountBtn) ? <button onClick={this.showRegisterAccountFields}>register account</button> : null }
                    { !this.data.currentUser.registered && this.state.showRegisterNewAccountFields ? <div>
                        username: <input ref="fromDummyToReal_username" value={this.data.currentUser.username}/>
                        password: <input ref="fromDummyToReal_password" value={Random.id()}/>
                        <br/>
                        <button onClick={this.registerDummyUser}>register</button>
                        <button onClick={this.hideRegisterAccountFields}>cancel</button>
                    </div> : null }
                    <br/>
                    <br/>
                    search for:
                    <input className="individualStockSearch"
                           id="individualStockSearch" onChange={this.searchingStock} onKeyDown={this.selectFirstSearchResult}/>
                    <div id="individualStockSearchResults">{this.renderSearchResults()}</div>
                    <br/>
                    { this.state.selectedStock ? <div>
                        selected stock:
                        {this.state.selectedStock}<button onClick={this.clearSelectedStock}>clear</button>
                    </div> : null}

                    <div className="btn-group" role="group" aria-label="...">
                        <button type="button" className={this.state.showAvgRatings && !this.state.showWeightedRating ? _ab : _b} id='avg' onClick={this.selectTab}>avg only</button>
                        <button type="button" className={this.state.showAvgRatings && this.state.showWeightedRating ? _ab : _b} id='both' onClick={this.selectTab}>both</button>
                        <button type="button" className={!this.state.showAvgRatings && this.state.showWeightedRating ? _ab : _b} id='wgt' onClick={this.selectTab}>wgt only</button>
                    </div>
                    {/*<br/>*/}
                    { this.state.individualStockStartDate || this.state.individualStockEndDate ? <div>
                        <button onClick={this.resetDateRange}>reset date range</button>
                    </div> : null }
                    {/*<br/>*/}
                    {this.state.individualStockStartDate}
                    {/*<br/>*/}
                    {this.state.individualStockEndDate}
                    {/*<br/>*/}

                    { this.state.selectedStock && this.state.individualStockStartDate && this.state.individualStockEndDate ? <div>
                        <br/>
                        <br/>
                        <h1>Details for {this.state.selectedStock}</h1>
                        <div className="col-md-12 individualStockGraph">
                            <StocksGraph
                                stocksToGraphObjects={this.state.stocksToGraphObjects}/>
                        </div>
                    </div> : null}

                    {this.state.selectedStock ?
                        <div className="container">
                            <AverageAndWeightedRatings
                                symbol={this.state.selectedStock}
                                showAvgRatings={this.state.showAvgRatings}
                                showWeightedRating={this.state.showWeightedRating}/>
                        </div> :
                        null
                    }

                </div> : "u havta be logged in."}
            </div>
        )
    }
})