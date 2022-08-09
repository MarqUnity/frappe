import Widget from "./base_widget.js";

frappe.provide("frappe.utils");

export default class EmbedWidget extends Widget {
	constructor(opts) {
		opts.shadow = true;
		super(opts);
	}

	get_config() {
		return {
			document_type: this.document_type,
			label: this.label,
			embed_filter: this.embed_filter
		};
	}

	set_actions() {
		if (this.in_customize_mode) return;

		this.setup_add_new_button();
		this.setup_refresh_list_button();
		this.setup_filter_list_button();
	}

	setup_add_new_button() {
		this.add_new_button = $(
			`<div class="add-new btn btn-xs pull-right" title="${__("Add New " + this.document_type)}">
				${frappe.utils.icon('add', 'sm')}
			</div>`
		);

		this.add_new_button.appendTo(this.action_area);
		this.add_new_button.on("click", () => {
			frappe.set_route(
				frappe.utils.generate_route({type: 'doctype', name: this.document_type, doc_view: 'New'})
			);
		});
	}

	setup_refresh_list_button() {
		this.refresh_list = $(
			`<div class="refresh-list btn btn-xs pull-right" title="${__("Refresh List")}">
				${frappe.utils.icon('refresh', 'sm')}
			</div>`
		);

		this.refresh_list.appendTo(this.action_area);
		this.refresh_list.on("click", () => {
			this.body.empty();
			this.set_body();
		});
	}

	setup_filter_list_button() {
		this.filter_list = $(
			`<div class="filter-list btn btn-xs pull-right" title="${__("Add/Update Filter")}">
				${frappe.utils.icon('filter', 'sm')}
			</div>`
		);

		this.filter_list.appendTo(this.action_area);
		this.filter_list.on("click", () => this.setup_filter_dialog());
	}

	setup_filter(doctype) {
		if (this.filter_group) {
			this.filter_group.wrapper.empty();
			delete this.filter_group;
		}

		this.filters = frappe.utils.get_filter_from_json(this.embed_filter, doctype);

		this.filter_group = new frappe.ui.FilterGroup({
			parent: this.dialog.get_field("filter_area").$wrapper,
			doctype: doctype,
			on_change: () => {},
		});

		frappe.model.with_doctype(doctype, () => {
			this.filter_group.add_filters_to_filter_group(this.filters);
			this.dialog.set_df_property("filter_area", "hidden", false);
		});
	}

	setup_filter_dialog() {
		let fields = [
			{
				fieldtype: "HTML",
				fieldname: "filter_area"
			}
		];
		let me = this;
		this.dialog = new frappe.ui.Dialog({
			title: __("Set Filters for {0}", [this.document_type]),
			fields: fields,
			primary_action: function() {
				let old_filter = me.embed_filter;
				let filters = me.filter_group.get_filters();
				me.embed_filter = frappe.utils.get_filter_as_json(filters);

				this.hide();

				if (old_filter != me.embed_filter) {
					me.body.empty();
					me.set_footer();
					me.set_body();
				}
			},
			primary_action_label: "Set"
		});

		this.dialog.show();
		this.setup_filter(this.document_type);
	}

	render_loading_state() {
		this.body.empty();
		this.loading = $(
			`<div class="list-loading-state text-muted">${__(
				"Loading..."
			)}</div>`
		);
		this.loading.appendTo(this.body);
	}

	render_no_data_state() {
		this.loading = $(
			`<div class="list-no-data-state text-muted">${__(
				"No Data..."
			)}</div>`
		);
		this.loading.appendTo(this.body);
	}

	setup_embed_item(doc) {
		const indicator = frappe.get_indicator(doc, this.document_type);

		let $embed_item = $(`
			<div class="quick-list-item">
				<div class="ellipsis left">
					<div class="ellipsis title"
						title="${strip_html(doc[this.title_field_name])}">
						${strip_html(doc[this.title_field_name])}
					</div>
					<div class="timestamp text-muted">
						${frappe.datetime.prettyDate(doc.modified)}
					</div>
				</div>
			</div>
		`);

		if (indicator) {
			$(`
				<div class="status indicator-pill ${indicator[1]} ellipsis">
					${__(indicator[0])}
				</div>
			`).appendTo($embed_item);
		}

		$(`<div class="right-arrow">${frappe.utils.icon('right', 'xs')}</div>`).appendTo($embed_item);

		$embed_item.click(() => {
			frappe.set_route(`${frappe.utils.get_form_link(this.document_type, doc.name)}`);
		});

		return $embed_item;
	}

	set_body() {
		this.widget.addClass("quick-list-widget-box");

		this.render_loading_state();

		frappe.model.with_doctype(this.document_type, () => {
			let fields = ['name'];

			// get name of title field
			if (!this.title_field_name) {
				let meta = frappe.get_meta(this.document_type);
				this.title_field_name = meta && meta.title_field || 'name';
			}

			if (this.title_field_name && this.title_field_name != 'name') {
				fields.push(this.title_field_name);
			}

			// check doctype has status field
			this.has_status_field = frappe.meta.has_field(this.document_type, 'status');

			if (this.has_status_field) {
				fields.push('status');
				fields.push('docstatus');

				// add workflow state field if workflow exist & is active
				let workflow_fieldname = frappe.workflow.get_state_fieldname(this.document_type);
				workflow_fieldname && fields.push(workflow_fieldname);
			}

			fields.push('modified');

			let embed_filter = frappe.utils.get_filter_from_json(this.embed_filter);

			let args = {
				method: 'frappe.desk.reportview.get',
				args: {
					doctype: this.document_type,
					fields: fields,
					filters: embed_filter,
					order_by: 'modified desc',
					start: 0,
					page_length: 4
				}
			};

			frappe.call(args).then((r) => {
				if (!r.message) return;
				let data = r.message;

				this.body.empty();
				data = !Array.isArray(data)
					? frappe.utils.dict(data.keys, data.values)
					: data;

				if (!data.length) {
					this.render_no_data_state();
					return;
				}

				this.embed = data.map(doc => this.setup_embed_item(doc));
				this.embed.forEach($embed_item => $embed_item.appendTo(this.body));
			});
		});
	}

	set_footer() {
		this.footer.empty();

		let filters = frappe.utils.get_filter_from_json(this.embed_filter);
		if (filters) {
			frappe.route_options = filters;
		}
		let route = frappe.utils.generate_route({type: 'doctype', name: this.document_type});
		this.see_all_button = $(`
			<a href="${route}"class="see-all btn btn-xs">View List</a>
		`).appendTo(this.footer);
	}
}
