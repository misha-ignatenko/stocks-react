PickListStockEntryPage = React.createClass({
    propTypes: {
        pickListId: React.PropTypes.string.isRequired
    },

    addStockToPickList(event) {
        event.preventDefault();
        var stockId = React.findDOMNode(this.refs.addStockToPickListTextInput).value.trim();
        var _dateAdded = React.findDOMNode(this.refs.addStockToPickListDateInput).value;
        var pickListId = this.props.pickListId;
        Meteor.call("addStockToPickList", pickListId, stockId, _dateAdded);
        React.findDOMNode(this.refs.addStockToPickListTextInput).value = "";
        React.findDOMNode(this.refs.addStockToPickListDateInput).value = "";
    },

    removeStockFromPickList(event) {
        event.preventDefault();
        var stockId = React.findDOMNode(this.refs.textInput).value.trim();
        var pickListId = this.props.pickListId;
        Meteor.call("removeStockFromPickList", pickListId, stockId);
        React.findDOMNode(this.refs.textInput).value = "";
    },

    render: function() {
        return (
            <div className="pickListEntryPage">
                <p>add a stock to pick list</p>
                <form className="pickListEntryForm" onSubmit={this.addStockToPickList} >
                    <input
                        type="text"
                        ref="addStockToPickListTextInput"
                        placeholder="Type to add new stock to selected pick list" />
                    <input
                        type="date"
                        ref="addStockToPickListDateInput" />
                </form>
                <p>remove a stock from pick list</p>
                <form className="removeStockFromPickList" onSubmit={this.removeStockFromPickList}>
                    instead of having remove form just click on stock that was already on list and then date-removed field will as to be filled before pressing 'x'
                    <input
                        type="text"
                        ref="textInputTwo"
                        placeholder="Type to add new stock to selected pick list" />
                    <input
                        type="date"
                        ref="dateInputForStockRemovalFromPickList" />
                </form>
            </div>
        );
    }
});