PickList = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState: function() {
        return {
            showStockEntryPage: false,
            hidePickListItems: true
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

                <button className="btn btn-default" onClick={this.toggleHidePickListItems}>
                    { this.state.hidePickListItems ? "show items" : "hide items" }
                </button>

                <span className="text">
                    <strong>{this.props.pickList.addedByUsername}</strong>: {this.props.pickList.listName}. Stocks ({this.data.pickListItemsCount}):
                    { !this.state.hidePickListItems ? (
                        <ul>{this.renderPickListItems()}</ul>
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