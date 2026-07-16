"use client";

import { FormEvent } from "react";

import { AdminNavButton } from "./AdminAttention";

export type ProductMgmtPriority = "high" | "low" | "medium";
export type ProductMgmtStatus = "deferred" | "in_progress" | "open" | "resolved";
export type ProductMgmtSection = string;

export type ProductMgmtArea = {
  id: string;
  area_key: string;
  label: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type ProductMgmtItem = {
  ask_submission_id: string | null;
  id: string;
  area_id: string;
  title: string;
  body: string;
  status: ProductMgmtStatus;
  priority: ProductMgmtPriority;
  current_version_number: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ProductMgmtItemDraft = {
  areaId: string;
  body: string;
  changeNote: string;
  priority: ProductMgmtPriority;
  status: ProductMgmtStatus;
  title: string;
};

export type ProductMgmtSectionConfig = {
  description: string | null;
  key: string;
  label: string;
};

type SelectedProductMgmtSectionConfig = {
  description: string | null;
  label: string;
};

type AdminProductManagementPanelProps = {
  cancelEditingProductMgmtItem: () => void;
  editingProductMgmtItemId: string | null;
  formatDate: (value: string | null) => string;
  handleChangeProductMgmtSection: (sectionKey: ProductMgmtSection) => void;
  handleCreateProductMgmtArea: (event: FormEvent<HTMLFormElement>) => void;
  handleCreateProductMgmtItem: (event: FormEvent<HTMLFormElement>) => void;
  handleResolveProductMgmtItem: (item: ProductMgmtItem) => void;
  handleRetireProductMgmtArea: (area: ProductMgmtArea) => void;
  handleUpdateProductMgmtItem: (
    event: FormEvent<HTMLFormElement>,
    item: ProductMgmtItem
  ) => void;
  loadingProductMgmt: boolean;
  newProductMgmtAreaDescription: string;
  newProductMgmtAreaLabel: string;
  newProductMgmtBody: string;
  newProductMgmtChangeNote: string;
  newProductMgmtPriority: ProductMgmtPriority;
  newProductMgmtStatus: ProductMgmtStatus;
  newProductMgmtTitle: string;
  openAskSubmissionReview: (submissionId: string) => void;
  productMgmtAreas: ProductMgmtArea[];
  productMgmtItemDraft: ProductMgmtItemDraft | null;
  productMgmtItems: ProductMgmtItem[];
  resolvingProductMgmtItemId: string | null;
  retiringProductMgmtAreaId: string | null;
  savingProductMgmtArea: boolean;
  savingProductMgmtEditItemId: string | null;
  savingProductMgmtItem: boolean;
  selectedProductMgmtArea: ProductMgmtArea | null;
  selectedProductMgmtItems: ProductMgmtItem[];
  selectedProductMgmtSection: ProductMgmtSection;
  selectedProductMgmtSectionConfig: SelectedProductMgmtSectionConfig;
  setNewProductMgmtAreaDescription: (value: string) => void;
  setNewProductMgmtAreaLabel: (value: string) => void;
  setNewProductMgmtBody: (value: string) => void;
  setNewProductMgmtChangeNote: (value: string) => void;
  setNewProductMgmtPriority: (value: ProductMgmtPriority) => void;
  setNewProductMgmtStatus: (value: ProductMgmtStatus) => void;
  setNewProductMgmtTitle: (value: string) => void;
  setShowProductMgmtAreaForm: (updater: (isVisible: boolean) => boolean) => void;
  showProductMgmtAreaForm: boolean;
  startEditingProductMgmtItem: (item: ProductMgmtItem) => void;
  updateProductMgmtItemDraft: (
    field: keyof ProductMgmtItemDraft,
    value: string
  ) => void;
  visibleProductMgmtSections: ProductMgmtSectionConfig[];
};

function productMgmtStatusLabel(status: ProductMgmtStatus) {
  return status.replace("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function productMgmtStatusClassName(status: ProductMgmtStatus) {
  if (status === "resolved") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (status === "in_progress") {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }

  if (status === "deferred") {
    return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }

  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

export function AdminProductManagementPanel({
  cancelEditingProductMgmtItem,
  editingProductMgmtItemId,
  formatDate,
  handleChangeProductMgmtSection,
  handleCreateProductMgmtArea,
  handleCreateProductMgmtItem,
  handleResolveProductMgmtItem,
  handleRetireProductMgmtArea,
  handleUpdateProductMgmtItem,
  loadingProductMgmt,
  newProductMgmtAreaDescription,
  newProductMgmtAreaLabel,
  newProductMgmtBody,
  newProductMgmtChangeNote,
  newProductMgmtPriority,
  newProductMgmtStatus,
  newProductMgmtTitle,
  openAskSubmissionReview,
  productMgmtAreas,
  productMgmtItemDraft,
  productMgmtItems,
  resolvingProductMgmtItemId,
  retiringProductMgmtAreaId,
  savingProductMgmtArea,
  savingProductMgmtEditItemId,
  savingProductMgmtItem,
  selectedProductMgmtArea,
  selectedProductMgmtItems,
  selectedProductMgmtSection,
  selectedProductMgmtSectionConfig,
  setNewProductMgmtAreaDescription,
  setNewProductMgmtAreaLabel,
  setNewProductMgmtBody,
  setNewProductMgmtChangeNote,
  setNewProductMgmtPriority,
  setNewProductMgmtStatus,
  setNewProductMgmtTitle,
  setShowProductMgmtAreaForm,
  showProductMgmtAreaForm,
  startEditingProductMgmtItem,
  updateProductMgmtItemDraft,
  visibleProductMgmtSections,
}: AdminProductManagementPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold">Product management</h2>
        <p className="mt-1 max-w-3xl text-slate-600">
          Track bugs, Early Access readiness, release notes, wishlist items, and
          admin follow-ups without leaving the app. Each add or status change is
          versioned.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Product area</p>
          <div className="space-y-2">
            {visibleProductMgmtSections.map((section) => {
              const isSelected = selectedProductMgmtSection === section.key;
              const area = productMgmtAreas.find(
                (item) => item.area_key === section.key
              );
              const itemCount = productMgmtItems.filter(
                (item) => item.area_id === area?.id
              ).length;

              return (
                <AdminNavButton
                  className="w-full px-3 py-3 text-left"
                  followupCount={0}
                  isSelected={isSelected}
                  key={section.key}
                  newCount={0}
                  onClick={() =>
                    handleChangeProductMgmtSection(
                      section.key as ProductMgmtSection
                    )
                  }
                >
                  <span className="block font-semibold">{section.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {productMgmtAreas.length > 0
                      ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
                      : "Run SQL to enable entries"}
                  </span>
                </AdminNavButton>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <button
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              onClick={() =>
                setShowProductMgmtAreaForm((isVisible) => !isVisible)
              }
              type="button"
            >
              {showProductMgmtAreaForm ? "Hide lane form" : "+ Add lane"}
            </button>
            {showProductMgmtAreaForm ? (
              <form
                className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
                onSubmit={handleCreateProductMgmtArea}
              >
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">
                    Lane name
                  </span>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                    disabled={savingProductMgmtArea}
                    onChange={(event) =>
                      setNewProductMgmtAreaLabel(event.target.value)
                    }
                    placeholder="e.g. Beta Program"
                    required
                    value={newProductMgmtAreaLabel}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">
                    Description
                  </span>
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                    disabled={savingProductMgmtArea}
                    onChange={(event) =>
                      setNewProductMgmtAreaDescription(event.target.value)
                    }
                    placeholder="What belongs in this lane?"
                    value={newProductMgmtAreaDescription}
                  />
                </label>
                <button
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                  disabled={
                    savingProductMgmtArea || !newProductMgmtAreaLabel.trim()
                  }
                  type="submit"
                >
                  {savingProductMgmtArea ? "Adding..." : "Add lane"}
                </button>
              </form>
            ) : null}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedProductMgmtSectionConfig.label}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedProductMgmtSectionConfig.description}
                </p>
              </div>
              {selectedProductMgmtArea &&
              selectedProductMgmtItems.length === 0 ? (
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:bg-slate-100"
                  disabled={
                    retiringProductMgmtAreaId === selectedProductMgmtArea.id
                  }
                  onClick={() =>
                    handleRetireProductMgmtArea(selectedProductMgmtArea)
                  }
                  type="button"
                >
                  {retiringProductMgmtAreaId === selectedProductMgmtArea.id
                    ? "Retiring..."
                    : "Retire lane"}
                </button>
              ) : null}
            </div>
          </div>

          <form
            className="rounded-lg border border-slate-200 bg-white p-4"
            onSubmit={handleCreateProductMgmtItem}
          >
            <h3 className="text-lg font-semibold text-slate-900">Add entry</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Title
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                  onChange={(event) =>
                    setNewProductMgmtTitle(event.target.value)
                  }
                  placeholder="e.g. Add onboarding support link"
                  required
                  value={newProductMgmtTitle}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Priority
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                  onChange={(event) =>
                    setNewProductMgmtPriority(
                      event.target.value as ProductMgmtPriority
                    )
                  }
                  value={newProductMgmtPriority}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Status
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                  onChange={(event) =>
                    setNewProductMgmtStatus(
                      event.target.value as ProductMgmtStatus
                    )
                  }
                  value={newProductMgmtStatus}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="deferred">Deferred</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                onChange={(event) => setNewProductMgmtBody(event.target.value)}
                placeholder="What should future reviewers remember about this?"
                value={newProductMgmtBody}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">
                Version note
              </span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                onChange={(event) =>
                  setNewProductMgmtChangeNote(event.target.value)
                }
                value={newProductMgmtChangeNote}
              />
            </label>
            <button
              className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              disabled={
                !selectedProductMgmtArea ||
                savingProductMgmtItem ||
                !newProductMgmtTitle.trim()
              }
              type="submit"
            >
              {savingProductMgmtItem ? "Adding..." : "Add entry"}
            </button>
            {!selectedProductMgmtArea ? (
              <p className="mt-2 text-sm text-slate-500">
                Run the product management SQL in Supabase to enable entries for
                this tab.
              </p>
            ) : null}
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">
                Current entries
              </h3>
              {loadingProductMgmt ? (
                <span className="text-sm text-slate-500">Loading...</span>
              ) : null}
            </div>

            {selectedProductMgmtItems.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No entries in this lane yet.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {selectedProductMgmtItems.map((item) => {
                  const isResolved = item.status === "resolved";
                  const isEditing =
                    editingProductMgmtItemId === item.id &&
                    productMgmtItemDraft !== null;
                  const isSavingEdit = savingProductMgmtEditItemId === item.id;

                  return (
                    <article
                      className={`rounded-md border p-3 ${
                        isResolved
                          ? "border-slate-200 bg-slate-50"
                          : "border-slate-200 bg-white"
                      }`}
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                            v{item.current_version_number} · {item.priority}{" "}
                            priority · updated {formatDate(item.updated_at)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${productMgmtStatusClassName(
                            item.status
                          )}`}
                        >
                          {productMgmtStatusLabel(item.status)}
                        </span>
                      </div>
                      {item.body ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                          {item.body}
                        </p>
                      ) : null}

                      {item.ask_submission_id ? (
                        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-700">
                              Created from Ask intake.
                            </p>
                            <button
                              className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700"
                              onClick={() =>
                                openAskSubmissionReview(
                                  item.ask_submission_id ?? ""
                                )
                              }
                              type="button"
                            >
                              Open Ask review
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {isEditing && productMgmtItemDraft ? (
                        <form
                          className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3"
                          onSubmit={(event) =>
                            handleUpdateProductMgmtItem(event, item)
                          }
                        >
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">
                                Title
                              </span>
                              <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                disabled={isSavingEdit}
                                onChange={(event) =>
                                  updateProductMgmtItemDraft(
                                    "title",
                                    event.target.value
                                  )
                                }
                                required
                                value={productMgmtItemDraft.title}
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">
                                Priority
                              </span>
                              <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                disabled={isSavingEdit}
                                onChange={(event) =>
                                  updateProductMgmtItemDraft(
                                    "priority",
                                    event.target.value as ProductMgmtPriority
                                  )
                                }
                                value={productMgmtItemDraft.priority}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">
                                Status
                              </span>
                              <select
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                disabled={isSavingEdit}
                                onChange={(event) =>
                                  updateProductMgmtItemDraft(
                                    "status",
                                    event.target.value as ProductMgmtStatus
                                  )
                                }
                                value={productMgmtItemDraft.status}
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In progress</option>
                                <option value="deferred">Deferred</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            </label>
                          </div>

                          <label className="mt-3 block">
                            <span className="text-sm font-medium text-slate-700">
                              Lane
                            </span>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={isSavingEdit}
                              onChange={(event) =>
                                updateProductMgmtItemDraft(
                                  "areaId",
                                  event.target.value
                                )
                              }
                              value={productMgmtItemDraft.areaId}
                            >
                              {productMgmtAreas.map((area) => (
                                <option key={area.id} value={area.id}>
                                  {area.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="mt-3 block">
                            <span className="text-sm font-medium text-slate-700">
                              Notes
                            </span>
                            <textarea
                              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={isSavingEdit}
                              onChange={(event) =>
                                updateProductMgmtItemDraft(
                                  "body",
                                  event.target.value
                                )
                              }
                              value={productMgmtItemDraft.body}
                            />
                          </label>

                          <label className="mt-3 block">
                            <span className="text-sm font-medium text-slate-700">
                              Version note
                            </span>
                            <input
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={isSavingEdit}
                              onChange={(event) =>
                                updateProductMgmtItemDraft(
                                  "changeNote",
                                  event.target.value
                                )
                              }
                              required
                              value={productMgmtItemDraft.changeNote}
                            />
                          </label>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                              disabled={
                                isSavingEdit ||
                                !productMgmtItemDraft.title.trim() ||
                                !productMgmtItemDraft.changeNote.trim()
                              }
                              type="submit"
                            >
                              {isSavingEdit ? "Saving..." : "Save edit"}
                            </button>
                            <button
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                              disabled={isSavingEdit}
                              onClick={cancelEditingProductMgmtItem}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!isEditing ? (
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => startEditingProductMgmtItem(item)}
                            type="button"
                          >
                            Edit
                          </button>
                        ) : null}
                        {!isResolved ? (
                          <button
                            className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 disabled:bg-slate-100 disabled:text-slate-400"
                            disabled={
                              resolvingProductMgmtItemId === item.id ||
                              isEditing
                            }
                            onClick={() => handleResolveProductMgmtItem(item)}
                            type="button"
                          >
                            {resolvingProductMgmtItemId === item.id
                              ? "Resolving..."
                              : "Mark resolved"}
                          </button>
                        ) : null}
                        {isResolved && item.resolved_at ? (
                          <span className="text-sm text-slate-500">
                            Resolved {formatDate(item.resolved_at)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
