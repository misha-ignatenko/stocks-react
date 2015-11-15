IndividualStock = React.createClass({
    mixins: [ReactMeteorData],

    getMeteorData() {
        let _user = Meteor.user();
        return {
            currentUser: _user,
            stocksWithAccess: Stocks.find().fetch()
        }
    },
    getInitialState: function()
    {
        return ({
            individualStockStartDate: moment().format("YYYY-MM-DD"),
            individualStockEndDate: moment().format("YYYY-MM-DD"),
            individualStockSearchResults: [],
            selectedStock: null
        });
    },
    componentDidMount: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#individualStockStartDate').datepicker(_datepickerOptions);
        $('#individualStockEndDate').datepicker(_datepickerOptions);
        var _that = this;

        $('.datepickerInput').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = moment(new Date(_newVal).toISOString()).format("YYYY-MM-DD");
            let _id = $(this).attr('id');
            let _set = {};
            _set[_id] = _momentDate;
            _that.setState(_set);
        });
    },
    searchingStock: function() {
        console.log('searchin 4 individual stock.');
        let _arrayOfStockSymbolsAvailable = _.pluck(this.data.stocksWithAccess, "_id");
        let _searchCandidates = _arrayOfStockSymbolsAvailable.filter(function(symbol) {
            if ($("#individualStockSearch").val() && symbol.search($("#individualStockSearch").val()) > -1) {
                return true;
            }
            return false;
        })
        //TODO get rid of non-letter charachers (except for . -- allowed)
        console.log(_searchCandidates);
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

    render: function() {
        return (
            <div className="container">
                { this.data.currentUser ? <div>
                    {this.data.currentUser.username}
                    <br/>
                    <br/>
                    search for:
                    <input className="individualStockSearch"
                           id="individualStockSearch" onChange={this.searchingStock}/>
                    <div id="individualStockSearchResults">{this.renderSearchResults()}</div>
                    <br/>
                    start date:
                    <input className="datepickerInput" id="individualStockStartDate" />
                    end date:
                    <input className="datepickerInput" id="individualStockEndDate" />
                    <br/>
                    <br/>
                    stats for this stock based on these dates will be here:
                    <br/>
                    {this.state.individualStockStartDate}
                    <br/>
                    {this.state.individualStockEndDate}
                    <br/>
                    { this.state.selectedStock ? <div>
                        selected stock:
                        {this.state.selectedStock}<button onClick={this.clearSelectedStock}>clear</button>
                    </div> : null}

                    { this.state.selectedStock && this.state.individualStockStartDate && this.state.individualStockEndDate ? <div>
                        <br/>
                        <br/>
                        <h1>Details for {this.state.selectedStock}</h1>
                    </div> : null}
                </div> : "u havta be logged in."}
            </div>
        )
    }
})