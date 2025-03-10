import { MonksActiveTiles, log, setting, i18n, makeid } from '../monks-active-tiles.js';
import { ActionConfig } from "../apps/action-config.js";
import { TileHistory } from './tile-history.js';

export const WithActiveTileConfig = (TileConfig) => {
    class ActiveTileConfig extends TileConfig {
        constructor(...args) {
            super(...args);
        }

        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                classes: ["monks-active-tiles", "sheet"],
                template: "modules/monks-active-tiles/templates/active-tile-config.html",
                scrollY: ["ol.item-list"],
                dragDrop: [{ dragSelector: ".item", dropSelector: ".item-list" }]
            });
        }

        async getData(options) {
            this.object._normalize();
            const data = mergeObject({ 'data.flags.monks-active-tiles.minrequired': 0 }, super.getData(options));

            data.triggerModes = {
                'enter': i18n("MonksActiveTiles.mode.enter"),
                'exit': i18n("MonksActiveTiles.mode.exit"),
                'both': i18n("MonksActiveTiles.mode.both"),
                'movement': i18n("MonksActiveTiles.mode.movement"),
                'click': i18n("MonksActiveTiles.mode.click"),
                'manual': i18n("MonksActiveTiles.mode.manual")
            };
            data.triggerRestriction = { 'all': i18n("MonksActiveTiles.restrict.all"), 'player': i18n("MonksActiveTiles.restrict.player"), 'gm': i18n("MonksActiveTiles.restrict.gm") };
            data.triggerControlled = { 'all': i18n("MonksActiveTiles.control.all"), 'player': i18n("MonksActiveTiles.control.player"), 'gm': i18n("MonksActiveTiles.control.gm") };

            data.actions = this.object.data.flags['monks-active-tiles'].actions
                .map(a => {
                    let trigger = MonksActiveTiles.triggerActions[a.action];
                    let content = (trigger == undefined ? 'Unknown' : (trigger.content ? trigger.content(trigger, a) : i18n(trigger.name)) + (a.delay > 0 ? ' after ' + a.delay + ' seconds' : ''));
                    return {
                        id: a.id,
                        content: content
                    };
                });

            return data;
        }

        _onDragStart(event) {
            let li = event.currentTarget.closest(".item");
            const isFolder = li.classList.contains("folder");
            const dragData = { type: this.constructor.documentName, id: li.dataset.id };
            event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
            this._dragType = dragData.type;
        }

        _canDragStart(selector) {
            return true;
        }

        _onDrop(event) {
            const cls = this.constructor.documentName;

            // Try to extract the data
            let data;
            try {
                data = JSON.parse(event.dataTransfer.getData('text/plain'));
            }
            catch (err) {
                return false;
            }

            // Identify the drop target
            const selector = this._dragDrop[0].dropSelector;
            const target = event.target.closest(".item") || null;

            // Call the drop handler
            if (target && target.dataset.id) {
                let actions = duplicate(this.object.data.flags["monks-active-tiles"].actions || []);

                if (data.id === target.dataset.id) return; // Don't drop on yourself

                let from = actions.findIndex(a => a.id == data.id);
                let to = actions.findIndex(a => a.id == target.dataset.id);
                actions.splice(to, 0, actions.splice(from, 1)[0]);

                this.object.data.flags["monks-active-tiles"].actions = actions;
                $('.action-items .item[data-id="' + data.id + '"]', this.element).insertBefore(target);
            }
        }

        async _onActionHoverIn(event) {
            event.preventDefault();
            if (!canvas.ready) return;
            const li = event.currentTarget;

            let action = (this.object.data.flags["monks-active-tiles"].actions || []).find(a => a.id == li.dataset.id);
            if (action && action.data.entity && !['tile', 'token', 'players', 'within', 'controlled', 'previous'].includes(action.data.entity.id)) {
                let entity = await fromUuid(action.data.entity.id);
                if (entity && entity._object) {
                    entity._object._onHoverIn(event);
                    this._highlighted = entity;
                }
            }
        }

        _onActionHoverOut(event) {
            event.preventDefault();
            if (this._highlighted) this._highlighted._object._onHoverOut(event);
            this._highlighted = null;
        }

        _getSubmitData(updateData = {}) {
            let data = super._getSubmitData(updateData);
            data["flags.monks-active-tiles.actions"] = this.object.data.flags["monks-active-tiles"].actions;
            return data;
        }

        activateListeners(html) {
            super.activateListeners(html);
            var that = this;

            $('.action-create', html).click(this._createAction.bind(this));
            $('.action-edit', html).click(this._editAction.bind(this));
            $('.action-delete', html).click(this._deleteAction.bind(this));
            $('.view-history', html).click(function () {
                new TileHistory(that.object).render(true);
            });

            //$('div[data-tab="triggers"] .item-list li.item', html).hover(this._onActionHoverIn.bind(this), this._onActionHoverOut.bind(this));
        }

        _createAction(event) {
            let action = { delay: 0 };
            if (this.object.data.flags["monks-active-tiles"].actions == undefined)
                this.object.data.flags["monks-active-tiles"].actions = [];
            new ActionConfig(action, {parent: this}).render(true);
        }

        _editAction(event) {
            let item = event.currentTarget.closest('.item');
            let action = this.object.data.flags["monks-active-tiles"].actions.find(obj => obj.id == item.dataset.id);
            if (action != undefined)
                new ActionConfig(action, { parent: this }).render(true);
        }

        _deleteAction(event) {
            let item = event.currentTarget.closest('.item');
            this.deleteAction(item.dataset.id);
        }

        deleteAction(id) {
            let actions = duplicate(this.object.data.flags["monks-active-tiles"].actions || []);
            actions.findSplice(i => i.id == id);
            this.object.setFlag("monks-active-tiles", "actions", actions);
            //$(`li[data-id="${id}"]`, this.element).remove();
        }

        resetPerToken() {
            this.object.resetPerToken();
        }
    }

    const constructorName = "ActiveTileConfig";
    Object.defineProperty(ActiveTileConfig.prototype.constructor, "name", { value: constructorName });
    return ActiveTileConfig;
};
