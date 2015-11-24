UpcomingEarningsRelease = React.createClass({

    mixins: [ReactMeteorData],

    propTypes: {
        symbol: React.PropTypes.string.isRequired
    },

    getInitialState() {

        return {
            individualStockStartDate: null,
            individualStockEndDate: null,
            stocksToGraphObjects: []
        }
    },

    getMeteorData() {
        let _symbol = this.props.symbol;

        return {
            individualEarningReleases: EarningsReleases.find({symbol: _symbol}).fetch()
        }
    },
    renderEpsMeanEstimates() {
        return this.data.individualEarningReleases.map((release) => {
            let _fieldNamesArray = release.fieldNames;
            let _earningsData = release.earningsData;
            let _indicesForEpsEstimates = [];
            _fieldNamesArray.forEach(function(item, index) {
                if (item === "EPS_MEAN_EST_QR1" || item === "EPS_MEAN_EST_QR2" || item === "EPS_MEAN_EST_QR3" || item === "EPS_MEAN_EST_QR4") {
                    _indicesForEpsEstimates.push(index)
                }
            });
            return _indicesForEpsEstimates.map((index) => {
                return (
                    <p>{_fieldNamesArray[index]}: {_earningsData[index]}</p>
                )
            });
        })
    },
    setDatepickerOptions: function() {
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
            _that.getLatestGraph(_that.props.symbol);
        });
    },
    getLatestGraph: function(symbol) {
        //make sure that end date is after start date
        //or disable dates based on previously selected dates
        if (symbol && this.state.individualStockStartDate && this.state.individualStockEndDate) {
            console.log('getting the latest graph.');
            var _that = this;
            Meteor.call('checkHistoricalData', symbol, this.state.individualStockStartDate, this.state.individualStockEndDate, function(err, result) {
                if (result && result.historicalData) {
                    _that.setState({
                        stocksToGraphObjects: [result]
                    });
                }
            });
        }
    },
    componentWillReceiveProps: function(nextProps) {
        this.getLatestGraph(nextProps.symbol);
    },

    render() {
        return (<div>

            <div className="datepickers" ref={this.setDatepickerOptions}>
                start date:
                <input className="datepickerInput" id="individualStockStartDate"/>
                end date:
                <input className="datepickerInput" id="individualStockEndDate" />
            </div>

            symbol: {this.props.symbol}
            <br/>
            {this.renderEpsMeanEstimates()}
            <div className="col-md-12 individualStockGraph">
                <StocksGraph
                    stocksToGraphObjects={this.state.stocksToGraphObjects}/>
            </div>
        </div>);
    }
});