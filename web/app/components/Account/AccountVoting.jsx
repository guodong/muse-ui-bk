import React from "react";
import Immutable from "immutable";
import {PropTypes} from "react";
import Translate from "react-translate-component";
import AutocompleteInput from "../Forms/AutocompleteInput";
import Tabs from "react-foundation-apps/src/tabs";
import counterpart from "counterpart";
import LoadingIndicator from "../LoadingIndicator";
import AccountSelector from "./AccountSelector";
import utils from "common/utils";
import WalletApi from "rpc_api/WalletApi";
import WalletDb from "stores/WalletDb.js"
import ChainStore from "api/ChainStore";
import validation from "common/validation"
import AccountImage from "./AccountImage";
import WorkerApproval from "./WorkerApproval";
import {FetchChainObjects} from "api/ChainStore";
import AccountVotingProxy from "./AccountVotingProxy";
import AccountsList from "./AccountsList";
import HelpContent from "../Utility/HelpContent";
import cnames from "classnames";
import connectToStores from "alt/utils/connectToStores";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";

let wallet_api = new WalletApi()

class AccountVoting extends React.Component {

    static propTypes = {
        account: React.PropTypes.object.isRequired // the account object that should be updated
    }

    constructor(props) {
        super(props);
        this.state = {
            proxy_account_id: "",//"1.2.16",
            witnesses: null,
            committee: null,
            vote_ids: Immutable.Set(),
            activeTab: props.tab || "proxy"
        };
        this.onProxyAccountChange = this.onProxyAccountChange.bind(this);
        this.onPublish = this.onPublish.bind(this);
        this.onReset = this.onReset.bind(this);
    }

    updateAccountData(account) {
        let options = account.get('options');
        let proxy_account_id = options.get('voting_account');
        if(proxy_account_id === "1.2.5" ) proxy_account_id = "";
        let votes = options.get('votes');
        let vote_ids = votes.toArray();
        let vids = Immutable.Set( vote_ids );
        ChainStore.getObjectsByVoteIds(vote_ids);
        FetchChainObjects(ChainStore.getObjectByVoteID, vote_ids, 5000).then(vote_objs => {
            //console.log( "Vote Objs: ", vote_objs );
            let witnesses = new Immutable.List();
            let committee = new Immutable.List();
            let workers = new Immutable.Set();
            vote_objs.forEach( obj => {
                let account_id = obj.get("committee_member_account");
                if (account_id) {
                    committee = committee.push(account_id);
                } else if( account_id = obj.get( "worker_account" ) ) {
                   // console.log( "worker: ", obj );
               //     workers = workers.add(obj.get("id"));
                } else if( account_id = obj.get("witness_account") ) {
                    witnesses = witnesses.push(account_id);
                }
            });
            let state = {
                proxy_account_id: proxy_account_id,
                witnesses: witnesses,
                committee: committee,
                workers: workers,
                vote_ids: vids,
                prev_proxy_account_id: proxy_account_id,
                prev_witnesses: witnesses,
                prev_committee: committee,
                prev_workers: workers,
                prev_vote_ids : vids
            };
            this.setState(state);
        });
    }

    isChanged() {
        let s = this.state;
        return s.proxy_account_id !== s.prev_proxy_account_id ||
               s.witnesses !== s.prev_witnesses ||
               s.committee !== s.prev_committee ||
               !Immutable.is(s.vote_ids, s.prev_vote_ids);
    }

    componentWillMount() {
        this.updateAccountData(this.props.account);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.account !== this.props.account) this.updateAccountData(nextProps.account);
    }

    onPublish() {
        let updated_account = this.props.account.toJS();
        updated_account.account = updated_account.id;
        updated_account.new_options = updated_account.options;
        let new_proxy_id = this.state.proxy_account_id;
        updated_account.new_options.voting_account = new_proxy_id ? new_proxy_id : "1.2.5";
        updated_account.new_options.num_witness = this.state.witnesses.size;
        updated_account.new_options.num_committee = this.state.committee.size;
        console.log( "vote_ids: ", this.state.vote_ids.toJS() );
        FetchChainObjects(ChainStore.getWitnessById, this.state.witnesses.toArray(), 4000).then( res => {
            let witnesses_vote_ids = res.map(o => o.get("vote_id"));
            return Promise.all([Promise.resolve(witnesses_vote_ids), FetchChainObjects(ChainStore.getCommitteeMemberById, this.state.committee.toArray(), 4000)]);
        }).then( res => {
            updated_account.new_options.votes = res[0]
                .concat(res[1].map(o => o.get("vote_id")))
                .concat(this.state.vote_ids.filter( id => id.split(":")[0] === "2" ).toArray() )
                .sort((a, b)=> { return parseInt(a.split(':')[1]) - parseInt(b.split(':')[1]) });
            console.log("updated_account: ", updated_account);
            var tr = wallet_api.new_transaction();
            tr.add_type_operation("account_update", updated_account);
            WalletDb.process_transaction(tr, null, true);
        });
    }

    onReset() {
        let s = this.state;
        this.setState({
            proxy_account_id: s.prev_proxy_account_id,
            witnesses: s.prev_witnesses,
            committee: s.prev_committee,
            workers: s.prev_workers,
            vote_ids: s.prev_vote_ids
        });
    }

    onAddItem(collection, item_id){
        let state = {};
        state[collection] = this.state[collection].push(item_id);
        this.setState(state);
    }

    onRemoveItem(collection, item_id){
        let state = {};
        state[collection] = this.state[collection].filter(i => i !== item_id);
        this.setState(state);
    }
    onAddVoteID( vote_id ) {
      let state={}
      state.vote_ids = this.state.vote_ids.add(vote_id);
      this.setState(state);
    }
    onRemoveVoteID( vote_id ) {
      let state={}
      state.vote_ids = this.state.vote_ids.delete(vote_id);
      this.setState(state);
    }

    onProxyAccountChange(proxy_account, current_proxy_input) {
        this.setState({
            proxy_account_id: proxy_account ? proxy_account.get("id") : "",
            proxy_account_name: current_proxy_input
        });
    }

    validateAccount(collection, account) {
        if(!account) return null;
        if(collection === "witnesses") {
            return FetchChainObjects(ChainStore.getWitnessById, [account.get("id")], 3000).then(res => {
                return res[0] ? null : "Not a witness";
            });
        }
        if(collection === "committee") {
            return FetchChainObjects(ChainStore.getCommitteeMemberById, [account.get("id")], 3000).then(res => {
                return res[0] ? null : "Not a committee member";
            });
        }
        return null;
    }

    _changeTab(value) {
        SettingsActions.changeViewSetting({
            votingTab: value
        });
        this.setState({activeTab: value});
    }

    onClearProxy(e) {
        e.preventDefault();
        this.setState({
            proxy_account_id: "",
            proxy_account_name: ""
        });
    }

    render() {
        let {activeTab} = this.state;
        let proxy_is_set = !!this.state.proxy_account_id;
        let publish_buttons_class = cnames("button", {disabled : !this.isChanged()});

        let workers = [];
        let botchedWorkers = ["1.14.1", "1.14.2", "1.14.3", "1.14.5"];

        for (var i = 0; i < 50; i++) {
            let id = "1.14." + i;
            let worker = ChainStore.getObject(id);
            if (worker === null) {
                break;
            }
            if (botchedWorkers.indexOf(id) === -1) {
                workers.push(
                    <WorkerApproval key={id} worker={id} vote_ids={this.state.vote_ids}
                        onAddVote={this.onAddVoteID.bind(this)}
                        onRemoveVote={this.onRemoveVoteID.bind(this)}
                    />
                )
            }
        };

        let proxyTabClass = cnames("tab-item", {"is-active": activeTab === "proxy"});
        let witnessTabClass = cnames("tab-item", {"is-active": activeTab === "witnesses"});
        let committeeTabClass = cnames("tab-item", {"is-active": activeTab === "committee"});
        let workerTabClass = cnames("tab-item", {"is-active": activeTab === "workers"});

        return (
            <div className="grid-content">
                <HelpContent style={{maxWidth: "800px"}} path="components/AccountVoting" />

                <div className="content-block">
                    <button className={cnames(publish_buttons_class, {success: this.isChanged()})} onClick={this.onPublish} tabIndex={4}>
                        <Translate content="account.votes.publish"/>
                    </button>
                    <button className={"outline " + publish_buttons_class} onClick={this.onReset} tabIndex={8}>
                        <Translate content="account.perm.reset"/>
                    </button>
                    {proxy_is_set ? (
                        <button className={"outline"} onClick={this.onClearProxy.bind(this)} tabIndex={8}>
                            <Translate content="account.votes.clear_proxy"/>
                        </button>) : null}
                </div>

                <div className="tabs" style={{maxWidth: "800px"}}>
                    <div className={proxyTabClass} onClick={this._changeTab.bind(this, "proxy")}>
                        <Translate content="account.votes.proxy_short" />
                    </div>
                    <div className={witnessTabClass} onClick={this._changeTab.bind(this, "witnesses")}>
                        <Translate content="explorer.witnesses.title" />
                    </div>
                    <div className={committeeTabClass} onClick={this._changeTab.bind(this, "committee")}>
                        <Translate content="explorer.committee_members.title" />
                    </div>
                    <div className={workerTabClass} onClick={this._changeTab.bind(this, "workers")}>
                        <Translate content="account.votes.workers_short" />
                    </div>
                </div>

                {/* Tab content */}
                <div style={{paddingTop: "1em"}}>

                {activeTab === "proxy" ? (
                    <div className="content-block">
                        <HelpContent style={{maxWidth: "800px"}} path="components/AccountVotingProxy" />
                        <AccountVotingProxy
                            currentProxy={this.state.proxy_account_name}
                            currentAccount={this.props.account}
                            proxyAccount={this.state.proxy_account_id}
                            onProxyAccountChanged={this.onProxyAccountChange}
                        />
                    </div>) : null}

                {activeTab === "witnesses" ? (
                    <div className={cnames("content-block", {disabled : proxy_is_set})}>
                        <HelpContent style={{maxWidth: "800px"}} path="components/AccountVotingWitnesses" />
                        <AccountsList
                            type="witness"
                            label="account.votes.add_witness_label"
                            items={this.state.witnesses}
                            validateAccount={this.validateAccount.bind(this, "witnesses")}
                            onAddItem={this.onAddItem.bind(this, "witnesses")}
                            onRemoveItem={this.onRemoveItem.bind(this, "witnesses")}
                            tabIndex={proxy_is_set ? -1 : 2}/>
                    </div>) : null}

                {activeTab === "committee" ? (
                    <div className={cnames("content-block", {disabled : proxy_is_set})}>
                        <HelpContent style={{maxWidth: "800px"}} path="components/AccountVotingCommittee" />
                        <AccountsList
                            type="committee"
                            label="account.votes.add_committee_label"
                            items={this.state.committee}
                            validateAccount={this.validateAccount.bind(this, "committee")}
                            onAddItem={this.onAddItem.bind(this, "committee")}
                            onRemoveItem={this.onRemoveItem.bind(this, "committee")}
                            tabIndex={proxy_is_set ? -1 : 3}/>
                    </div>) : null}

                {activeTab === "workers" ? (
                    <div className={cnames("content-block", {disabled : proxy_is_set})}>
                        <HelpContent style={{maxWidth: "800px"}} path="components/AccountVotingWorkers" />
                        <div className="grid-block regular-padding small-up-1 medium-up-2 large-up-2">
                            {workers}
                        </div>
                    </div>) : null}

                </div>

            </div>
        )
    }
}

@connectToStores
class AccountVotingWrapper extends React.Component {
    static getStores() {
        return [SettingsStore]
    }

    static getPropsFromStores() {
        return {tab: SettingsStore.getState().viewSettings.get("votingTab")}
    }

    render () {
        return <AccountVoting {...this.props}/>
    }
}

export default AccountVotingWrapper;
