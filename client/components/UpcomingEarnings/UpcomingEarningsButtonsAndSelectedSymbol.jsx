UpcomingEarningsButtonsAndSelectedSymbol = React.createClass({
    mixins: [ReactMeteorData]

    , getInitialState() {
        return {
            selectedSymbolIndex: 1
            , showAllButtons: false
        };
    }

    , getMeteorData() {
        let _earningReleases = EarningsReleases.find().fetch();
        let _uniqueSymbols = _.uniq(_.pluck(_earningReleases, "symbol"))

        return {
            earningReleases: _earningReleases
            , ratingChanges: RatingChanges.find().fetch()
            , currentUser: Meteor.user()
            , uniqueSymbols: _uniqueSymbols
        };
    }

    , propTypes() {
        return {
            //startDate: React.PropTypes.number.isRequired
            //, endDate: React.PropTypes.number.isRequired
            //, selectedSymbol: React.PropTypes.string.isRequired
            //, showPickListItem: React.PropTypes.bool.isRequired
            //, setSelectedSymbol: React.PropTypes.func.isRequired
            focusStocksFunction: React.PropTypes.func.isRequired
        }
    }

    , setNewSelectedSymbol(symbol, index) {
        this.setState({
            selectedSymbolIndex: index
        });
    }

    , renderButtons() {
        //console.log("gonna render buttons");

        let _symbols = _.uniq(_.pluck(this.data.earningReleases, "symbol"));
        let _ratingChangesSymbols = _.pluck(this.data.ratingChanges, "symbol");


        console.log("symbols from rating changes: ", _ratingChangesSymbols);
        return _symbols.map((symbol, index) => {
            let _btnClass = "btn btn-default" + (index === this.state.selectedSymbolIndex ? " active" : "");
            let _key = symbol + "_" + index;
            let _count = _.countBy(_ratingChangesSymbols, function(symb) {
                return symb === symbol ? "yes" : "no";
            });





            let _ratingChangesForSymbol = _.filter(this.data.ratingChanges, function(obj) {
                return obj.symbol === symbol;
            })
            //console.log("rating changes for symbol: ", _ratingChangesForSymbol);
            let _uniqueResearchFirmIdsArr = _.uniq(_.pluck(_ratingChangesForSymbol, "researchFirmId"));
            //console.log("symbol: ", symbol);
            //console.log("unique research firm ids: ", _uniqueResearchFirmIdsArr);


            //todo now for each unique firm id look thru all _ratingChangesForSymbol and find the one with the latest date and
            //todo continued reject it if it's coverage dropped
            let _latestRatingScaleIdsForUniqueFirms = [];
            _uniqueResearchFirmIdsArr.forEach(function(researchFirmId) {
                //need to find the latest
                let _ratingChangesForSymbolAndResearchFirm = _.filter(_ratingChangesForSymbol, function(ratingChange) {
                    return ratingChange.researchFirmId === researchFirmId;
                })
                console.log("ratingChangesForSymbolAndFirm: ", _ratingChangesForSymbolAndResearchFirm);
                let _sorted = _.sortBy(_ratingChangesForSymbolAndResearchFirm, function(obj) {
                    let _date = new Date(obj["date"]).toISOString();
                    return _date;
                });
                console.log("MAKE SURE THIS IS ACTUALLY THE LATEST DATE");
                console.log("sorted: ", _sorted);
                //pick the first item in _sorted
                //find the corresponding ratingScale for newRatingId
                //check if the universal value of that rating scale is a number
                //if yes, then push to number of total latest analyst ratings
                let _latestRatingForStockByFirm = _sorted.length > 0 ? _sorted[_sorted.length - 1] : null;
                console.log("latest: ", _latestRatingForStockByFirm);
                if (_latestRatingForStockByFirm) {
                    let _ratingScale = RatingScales.findOne(_latestRatingForStockByFirm.newRatingId);
                    console.log("LATEST RATING SCALE: ", _ratingScale);
                    if (_ratingScale && _ratingScale.universalScaleValue && !isNaN(_ratingScale.universalScaleValue)) {
                        console.log("yay the latest universalScaleValue is a number");
                        _latestRatingScaleIdsForUniqueFirms.push(_ratingScale._id);
                    }
                }
            });

            //console.log("symbol: ", symbol );
            //console.log("_count: ", _count);
            let _numOfRatingChangesForSymbol = _count["yes"] ? _count["yes"] : 0;
            //TODO need number of current ratings with unique firms (excluding firms that dropped coverage), not number of rating changes
            let _numberOfLatestReports = _latestRatingScaleIdsForUniqueFirms.length;

            let nextAmt = this.data.uniqueSymbols.length - (1 + this.nextSymbolIndex(this.state.selectedSymbolIndex));

            return index === this.state.selectedSymbolIndex ?
                <button key={_key} className={_btnClass}>{symbol} ({_numberOfLatestReports})</button> :
                index === this.previousSymbolIndex(this.state.selectedSymbolIndex) ?
                    <button key={_key} className="btn btn-default" onClick={this.previousEarningsRelease}>
                        <span className="glyphicon glyphicon-chevron-left" aria-hidden="true"></span>Previous
                        <br/>{symbol} ({_numberOfLatestReports})
                    </button> :
                    index === this.nextSymbolIndex(this.state.selectedSymbolIndex) ?
                        <button key={_key} className="btn btn-default" onClick={this.nextEarningsRelease}>
                            Next({nextAmt} more)<span className="glyphicon glyphicon-chevron-right" aria-hidden="true"></span>
                            <br/>{symbol} ({_numberOfLatestReports})
                        </button> :
                        this.state.showAllButtons ?
                            <button key={_key} className={_btnClass} onClick={this.setNewSelectedSymbol.bind(this, symbol, index)}>{symbol} ({_numberOfLatestReports})</button> :
                            null;
        })
    }

    , shouldComponentUpdate(nextProps, nextState) {
        if (this.state.selectedSymbolIndex !== nextState.selectedSymbolIndex) {
            this.props.focusStocksFunction([
                this.data.uniqueSymbols[this.previousSymbolIndex(nextState.selectedSymbolIndex)],
                this.data.uniqueSymbols[nextState.selectedSymbolIndex],
                this.data.uniqueSymbols[this.nextSymbolIndex(nextState.selectedSymbolIndex)]
            ]);
            return true;
        } else if (this.state.showAllButtons !== nextState.showAllButtons) {
            return true;
        }
        return false;
    }

    , componentDidMount: function () {
        window.addEventListener('keydown', this.handleKeyDown);
    }

    , componentWillUnmount: function () {
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    , handleKeyDown: function (e) {
        let _symbolIndex = this.state.selectedSymbolIndex;
        let _new = e.which === 37 ? _symbolIndex - 1 : e.which === 39 ? _symbolIndex + 1 : _symbolIndex;
        if (_symbolIndex !== _new && this.data.uniqueSymbols && this.data.uniqueSymbols.length > 0) {
            if (e.which === 37) {
                this.previousEarningsRelease();
            } else if (e.which === 39) {
                this.nextEarningsRelease();
            }
        }
    }

    , previousSymbolIndex(_previousState) {
        let _newState = _previousState - 1 >= 0 ? _previousState - 1 : this.data.uniqueSymbols.length - 1;
        return _newState;
    }
    , nextSymbolIndex(_previousState) {
        let _newState = _previousState + 1 <= this.data.uniqueSymbols.length - 1 ? _previousState + 1 : 0;
        return _newState;
    }

    , previousEarningsRelease() {
        let _newState = this.previousSymbolIndex(this.state.selectedSymbolIndex);
        this.setState({
            selectedSymbolIndex: _newState
        });
    }
    , nextEarningsRelease() {
        let _newState = this.nextSymbolIndex(this.state.selectedSymbolIndex);
        this.setState({
            selectedSymbolIndex: _newState
        });
    }
    , changeShowAllBtnsSetting() {
        this.setState({
            showAllButtons: !this.state.showAllButtons
        });
    }

    , render() {
        let _symbol = this.data.uniqueSymbols ? this.data.uniqueSymbols[this.state.selectedSymbolIndex] : "";

        return (
            <div className="container">
                {this.props.startDate}
                {this.props.endDate}
                <br/>
                {!this.data.ratingChanges ? "subs loading" : <div className="row">
                    {this.data.currentUser ?
                        <button className="btn btn-default" onClick={this.changeShowAllBtnsSetting}>
                            {this.state.showAllButtons ? "hide individual buttons" : "show all individual buttons"}
                        </button> :
                        null
                    }
                    <br/>
                    {this.renderButtons()}
                    <br/>
                    <UpcomingEarningsRelease symbol={_symbol} currentUser={this.data.currentUser}/>
                </div>}
            </div>
        );
    }
});