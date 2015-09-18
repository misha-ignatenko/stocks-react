PickList = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            showStockEntryPage: false,
            hidePickListItems: true,
            showGraph: true,
            stocksToGraphObjects: []
        };
    },

    propTypes: {
        pickList: React.PropTypes.object.isRequired,
        showPrivateButton: React.PropTypes.bool.isRequired
    },

    getMeteorData() {
        let _pickListsQuery = {
            pickListId: this.props.pickList._id
        };

        //let _selectedStocksList = [];
        //this.state.stocksToGraphObjects.map((stockObj) => {
        //    _selectedStocksList.push(stockObj.stockId);
        //});
        //let _stockPricesQuery = { symbol: {$in: _selectedStocksList} };

        return {
            pickListItems: PickListItems.find(_pickListsQuery).fetch(),
            pickListItemsCount: PickListItems.find(_pickListsQuery).count(),
            //stockPrices: StockPrices.find(_stockPricesQuery).fetch()
        }
    },

    shouldComponentUpdate(nextProps, nextState) {
        //console.log("inside should component update of pickList.jsx");
        //console.log("next props: ", nextProps);
        //console.log("next state: ", nextState);
        //console.log("this.data.stockPrices: ", this.data.stockPrices);
        return nextProps.pickList._id === this.props.pickList._id;
    },

    toggleChecked() {
        Meteor.call("setChecked", this.props.pickList._id, ! this.props.pickList.checked);
    },

    deleteThisPickList() {
        Meteor.call("removePickList", this.props.pickList._id);
    },

    togglePrivate() {
        Meteor.call("setPrivate", this.props.pickList._id, ! this.props.pickList.private);
    },

    toggleHidePickListItems() {
        this.setState({
            hidePickListItems: !this.state.hidePickListItems
        });
    },

    showStockEntryPageAction() {
        this.setState({
            showStockEntryPage: !this.state.showStockEntryPage
        });
    },

    renderPickListItems() {
        return this.data.pickListItems.map((pickListItem) => {
            const showPickListItem = pickListItem.pickListId === this.props.pickList._id;

            return <PickListItem
                key={pickListItem._id}
                pickListItem={pickListItem}
                showPickListItem={showPickListItem}
                stockToGraphAddition={this.stockToGraphAddition} />;
        });
    },

    stockToGraphAddition: function(stockToShowObj) {
        if (stockToShowObj.shouldBeGraphed) {
            var _that = this;
            Meteor.call('checkHistoricalData', stockToShowObj.stockId, stockToShowObj.dateAdded, stockToShowObj.dateRemoved ? stockToShowObj.dateRemoved : "2015-09-11", function(err, result) {
                if (result && result.historicalData) {
                    let _allStocksToGraphObjects = _that.state.stocksToGraphObjects;
                    //now need to either add the stockId if it's not in the array already
                    let _findStock = _.find(_allStocksToGraphObjects, function(obj) {
                        return obj.stockId === stockToShowObj.stockId;
                    });
                    if (!_findStock) {
                        stockToShowObj.historicalData = result.historicalData;
                        _allStocksToGraphObjects.push(stockToShowObj);
                        _that.setState({
                            stocksToGraphObjects: _allStocksToGraphObjects
                        });
                    }
                }
            });
        } else {
            //make sure to remove the stock
            let _allStocksToGraphObjects = this.state.stocksToGraphObjects;
            let _findStock = _.find(_allStocksToGraphObjects, function(obj) {
                return obj.stockId === stockToShowObj.stockId;
            });
            if (_findStock) {
                let _newListOfObjects = _.reject(_allStocksToGraphObjects, function(obj) {
                    return obj.stockId === stockToShowObj.stockId;
                });
                this.setState({
                    stocksToGraphObjects: _newListOfObjects
                });
            }
        }
    },

    render() {
        const pickListClassName = (this.props.pickList.checked ? "checked" : "") + " " +
            (this.props.pickList.private ? "private" : "");

        return (
            <div className={pickListClassName}>
                <div className="row btn-group">
                    <button className="delete" onClick={this.deleteThisPickList}>
                        &times;
                    </button>

                    <input
                        type="checkbox"
                        readOnly={true}
                        checked={this.props.pickList.checked}
                        onClick={this.toggleChecked}/>


                    { this.props.showPrivateButton ? (
                        <button className="toggle-private" onClick={this.togglePrivate}>
                            { this.props.pickList.private ? "Private" : "Public" }
                        </button>
                    ) : ''}
                    <br/>
                    <br/>
                    <button className="btn btn-default" onClick={this.toggleHidePickListItems}>
                        { this.state.hidePickListItems ? "show items" : "hide items" }
                    </button>

                    <span className="text">
                        <strong>{this.props.pickList.addedByUsername}</strong>: {this.props.pickList.listName}. Stocks ({this.data.pickListItemsCount}):
                        { !this.state.hidePickListItems ? (
                            <div className="pickListItems">{this.renderPickListItems()}</div>
                        ) : ''}
                    </span>

                    <button className="btn btn-default" onClick={this.showStockEntryPageAction}>enter stocks</button>
                    { this.state.showStockEntryPage ? <PickListStockEntryPage pickListId={this.props.pickList._id} /> : null }
                </div>

                <div className="row btn-group">
                    { this.state.showGraph ? (
                        <StocksGraph
                            stocksToGraphObjects={this.state.stocksToGraphObjects}/>
                    ) : null}
                </div>
            </div>
        );
    }
});