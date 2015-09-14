PickList = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            showStockEntryPage: false,
            hidePickListItems: true,
            showGraph: true,
            stocksToGraph: [],
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

        return {
            pickListItems: PickListItems.find(_pickListsQuery).fetch(),
            pickListItemsCount: PickListItems.find(_pickListsQuery).count()
        }
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
            let _allStocksToGraphSoFar = this.state.stocksToGraph;
            let _allStocksToGraphObjects = this.state.stocksToGraphObjects;
            //now need to either add the stockId if it's not in the array already
            let _findStock = _.find(_allStocksToGraphSoFar, function(stockId) {
                return stockId === stockToShowObj.stockId;
            });
            if (!_findStock) {
                _allStocksToGraphSoFar.push(stockToShowObj.stockId);
                _allStocksToGraphObjects.push(stockToShowObj);
                this.setState({
                    stocksToGraph: _allStocksToGraphSoFar,
                    stocksToGraphObjects: _allStocksToGraphObjects
                });
            }
        } else {
            //make sure to remove the stock
            let _allStocksToGraphSoFar = this.state.stocksToGraph;
            let _allStocksToGraphObjects = this.state.stocksToGraphObjects;
            let _findStock = _.find(_allStocksToGraphSoFar, function(stockId) {
                return stockId === stockToShowObj.stockId;
            });
            if (_findStock) {
                let _newList = _.reject(_allStocksToGraphSoFar, function(stockId) {
                    return stockId === stockToShowObj.stockId;
                });
                let _newListOfObjects = _.reject(_allStocksToGraphObjects, function(obj) {
                    return obj.stockId === stockToShowObj.stockId;
                });
                this.setState({
                    stocksToGraph: _newList,
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

                { this.state.showGraph ? (
                    <StocksGraph
                        stocksToGraph={this.state.stocksToGraph}
                        stocksToGraphObjects={this.state.stocksToGraphObjects}/>
                ) : null}

                stocks to graph reactively: { this.state.stocksToGraph }

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

                <div className="row">
                    <button className="btn btn-default" onClick={this.showStockEntryPageAction}>enter stocks</button>
                    { this.state.showStockEntryPage ? <PickListStockEntryPage pickListId={this.props.pickList._id} /> : null }
                </div>
                <br/>
                <br/>
            </div>
        );
    }
});