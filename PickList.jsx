PickList = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            showStockEntryPage: false
        };
    },

    propTypes: {
        pickList: React.PropTypes.object.isRequired,
        showPrivateButton: React.PropTypes.bool.isRequired
    },

    getMeteorData() {
        let pickListsQuery = {

        };

        return {
            pickListItems: PickListItems.find(pickListsQuery).fetch(),
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
                showPickListItem={showPickListItem} />;
        });
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

                <span className="text">
                    <strong>{this.props.pickList.addedByUsername}</strong>: {this.props.pickList.listName}. Stocks: <ul>{this.renderPickListItems()}</ul>
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