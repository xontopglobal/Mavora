import React, { useEffect, useState } from "react";
import {
  createBusiness, deleteBusiness, deleteProduct, deleteService, listBusinesses, listMyCatalog, listPublishedCatalog,
  saveProduct, saveService, setBusinessStatus, setProductStatus, setServiceStatus, updateBusiness
} from "../lib/businessService";

const emptyBusiness = { name: "", description: "", website_url: "", country_code: "" };
const emptyProduct = { title: "", description: "", price: "", currency: "", category: "", product_url: "" };
const emptyService = { title: "", description: "", category: "", portfolio_url: "", contact_url: "" };

function Status({ value }) {
  return <span className={`business-status ${value === "published" ? "published" : "draft"}`}>{value === "published" ? "Published" : value === "archived" ? "Archived" : "Draft"}</span>;
}

function Field({ label, name, value, onChange, multiline = false, type = "text", required = false, maxLength }) {
  const common = { id: name, name, value: value ?? "", onChange, required, maxLength, autoComplete: "off" };
  return <label className="business-field" htmlFor={name}><span>{label}</span>{multiline
    ? <textarea {...common} rows="4" />
    : <input {...common} type={type} />}</label>;
}

export default function BusinessView({ userId }) {
  const [businesses, setBusinesses] = useState([]);
  const [catalog, setCatalog] = useState({ products: [], services: [] });
  const [publishedCatalog, setPublishedCatalog] = useState({ products: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(null);

  async function refresh() {
    if (!userId) {
      setError("Sign in to browse or manage business profiles.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [businessRows, ownerCatalog, publishedRows] = await Promise.all([
        listBusinesses(userId), listMyCatalog(userId), listPublishedCatalog(userId)
      ]);
      setBusinesses(businessRows);
      setCatalog(ownerCatalog);
      setPublishedCatalog(publishedRows);
    } catch (loadError) {
      setError(loadError.message || "Business information could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [userId]);

  const ownBusinesses = businesses.filter((business) => business.owner_id === userId);
  const ownRecords = [...catalog.products.map((item) => ({ ...item, kind: "product" })), ...catalog.services.map((item) => ({ ...item, kind: "service" }))];

  function openForm(type, item = null) {
    const defaults = type === "business" ? emptyBusiness : type === "product" ? emptyProduct : emptyService;
    setNotice("");
    setForm({ type, item, values: item ? { ...defaults, ...item, price: item.price == null ? "" : String(item.price) } : { ...defaults } });
  }

  function updateField(event) {
    setForm((current) => ({ ...current, values: { ...current.values, [event.target.name]: event.target.value } }));
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (form.type === "business") {
        if (form.item) await updateBusiness(userId, form.item.id, form.values);
        else await createBusiness(userId, form.values);
      } else if (form.type === "product") {
        await saveProduct(userId, form.item?.id, form.values);
      } else {
        await saveService(userId, form.item?.id, form.values);
      }
      setForm(null);
      setNotice(form.item ? "Changes saved." : `${form.type === "business" ? "Business" : form.type === "product" ? "Product" : "Service"} saved as a draft.`);
      await refresh();
    } catch (saveError) {
      setError(saveError.message || "Your changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, successMessage) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "That action could not be completed.");
    }
  }

  function askDelete(label, action) {
    if (window.confirm(`Delete this ${label}? This cannot be undone.`)) {
      void runAction(action, `${label[0].toUpperCase()}${label.slice(1)} deleted.`);
    }
  }

  function renderForm() {
    if (!form) return null;
    const typeLabel = form.type === "business" ? "business" : form.type;
    const values = form.values;
    return <form className="business-editor panel" onSubmit={submitForm}>
      <div className="business-editor-heading"><div><span className="eyebrow">{form.item ? "UPDATE YOUR LISTING" : "CREATE A DRAFT"}</span><h2>{form.item ? "Edit" : "New"} {typeLabel}</h2></div><button type="button" className="quiet-button" onClick={() => setForm(null)} disabled={saving}>Cancel</button></div>
      <div className="business-form-grid">
        {form.type === "business" ? <>
          <Field label="Business name" name="name" value={values.name} onChange={updateField} required maxLength={80}/>
          <Field label="Website (HTTPS)" name="website_url" value={values.website_url} onChange={updateField} type="url"/>
          <Field label="Country code" name="country_code" value={values.country_code?.trim?.() || ""} onChange={updateField} maxLength={2}/>
          <Field label="Description" name="description" value={values.description} onChange={updateField} multiline maxLength={1000}/>
        </> : form.type === "product" ? <>
          <Field label="Product name" name="title" value={values.title} onChange={updateField} required maxLength={120}/>
          <Field label="Category" name="category" value={values.category} onChange={updateField} maxLength={80}/>
          <Field label="Price" name="price" value={values.price} onChange={updateField} type="number"/>
          <Field label="Currency code" name="currency" value={values.currency} onChange={updateField} maxLength={3}/>
          <Field label="Product link (HTTPS)" name="product_url" value={values.product_url} onChange={updateField} type="url"/>
          <Field label="Description" name="description" value={values.description} onChange={updateField} multiline maxLength={2000}/>
        </> : <>
          <Field label="Service name" name="title" value={values.title} onChange={updateField} required maxLength={120}/>
          <Field label="Category" name="category" value={values.category} onChange={updateField} maxLength={80}/>
          <Field label="Portfolio link (HTTPS)" name="portfolio_url" value={values.portfolio_url} onChange={updateField} type="url"/>
          <Field label="Contact link (HTTPS)" name="contact_url" value={values.contact_url} onChange={updateField} type="url"/>
          <Field label="Description" name="description" value={values.description} onChange={updateField} multiline maxLength={2000}/>
        </>}
      </div>
      <div className="business-editor-footer"><span>New listings start as drafts. Only you can see them until published.</span><button className="button primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save draft"}</button></div>
    </form>;
  }

  return <>
    <div className="view-heading"><div><div className="eyebrow">MADE HERE, FOUND TOGETHER</div><h1>Business</h1><p>Discover published businesses and manage your own profiles and catalog.</p></div><button className="button primary" type="button" onClick={() => openForm("business")}>＋ Create a business</button></div>
    {error && <div className="business-feedback error" role="alert">{error}</div>}
    {notice && <div className="business-feedback success" role="status">{notice}</div>}
    {renderForm()}
    <section className="business-directory"><div className="section-title"><div><span className="eyebrow">DISCOVER WITH INTENTION</span><h2>Businesses</h2></div><span className="business-count">{loading ? "Loading…" : `${businesses.length} businesses`}</span></div>
      {loading ? <div className="business-state panel">Loading businesses…</div> : businesses.length ? <div className="business-record-grid">{businesses.map((business) => {
        const isOwner = business.owner_id === userId;
        return <article className="business-record panel" key={business.id}><div className="business-record-top"><div className="business-mark">◇</div><Status value={business.status}/></div><h3>{business.name}</h3><p>{business.description || "No description has been added yet."}</p><div className="business-record-meta">{business.country_code?.trim() || "Ofsocio business"}{business.website_url && <a href={business.website_url} target="_blank" rel="noreferrer">Visit website ↗</a>}</div>{isOwner && <div className="business-record-actions"><button className="quiet-button" type="button" onClick={() => openForm("business", business)}>Edit</button><button className="quiet-button" type="button" onClick={() => void runAction(() => setBusinessStatus(userId, business.id, business.status === "published" ? "draft" : "published"), business.status === "published" ? "Business unpublished." : "Business published.")}>{business.status === "published" ? "Unpublish" : "Publish"}</button><button className="business-danger" type="button" onClick={() => askDelete("business", () => deleteBusiness(userId, business.id))}>Delete</button></div>}</article>;
      })}</div> : <div className="business-state panel">No published businesses yet. Create a business profile to get started.</div>}
    </section>
    <section className="business-catalog panel"><div className="business-catalog-heading"><div><span className="eyebrow">PUBLISHED DISCOVERY</span><h2>Products &amp; services</h2><p>Published catalog items are visible to signed-in members under the existing owner-based listing model.</p></div></div>
      {loading ? <div className="business-state">Loading published listings…</div> : [...publishedCatalog.products.map((item) => ({ ...item, kind: "product" })), ...publishedCatalog.services.map((item) => ({ ...item, kind: "service" }))].filter((item) => item.owner_id !== userId).length ? <div className="business-catalog-list">{[...publishedCatalog.products.map((item) => ({ ...item, kind: "product" })), ...publishedCatalog.services.map((item) => ({ ...item, kind: "service" }))].filter((item) => item.owner_id !== userId).map((item) => <article className="business-catalog-row" key={`public-${item.kind}-${item.id}`}><div><div className="business-catalog-title"><strong>{item.title}</strong><Status value={item.status}/><span className="business-kind-label">{item.kind}</span></div><p>{item.description || item.category || "No description added."}</p>{item.kind === "product" && item.price != null && <small>{item.currency?.trim()} {Number(item.price).toFixed(2)}</small>}</div><div className="business-record-meta">{item.kind === "product" && item.product_url ? <a href={item.product_url} target="_blank" rel="noreferrer">View product ↗</a> : item.kind === "service" && item.portfolio_url ? <a href={item.portfolio_url} target="_blank" rel="noreferrer">View portfolio ↗</a> : null}</div></article>)}</div> : <div className="business-state">No published listings to discover yet.</div>}
    </section>
    <section className="business-catalog panel"><div className="business-catalog-heading"><div><span className="eyebrow">YOUR ACCOUNT CATALOG</span><h2>Products &amp; services</h2><p>The current schema scopes these listings to your account owner; it does not link them to a specific business profile.</p></div><div className="business-catalog-actions"><button className="button outline" type="button" onClick={() => openForm("product")} disabled={!ownBusinesses.length}>＋ Product</button><button className="button primary" type="button" onClick={() => openForm("service")} disabled={!ownBusinesses.length}>＋ Service</button></div></div>
      {!ownBusinesses.length && !loading ? <div className="business-state">Create a business profile before adding catalog listings.</div> : loading ? <div className="business-state">Loading your catalog…</div> : ownRecords.length ? <div className="business-catalog-list">{ownRecords.map((record) => <article className="business-catalog-row" key={`${record.kind}-${record.id}`}><div><div className="business-catalog-title"><strong>{record.title}</strong><Status value={record.status}/><span className="business-kind-label">{record.kind}</span></div><p>{record.description || record.category || "No description added."}</p>{record.kind === "product" && record.price != null && <small>{record.currency?.trim()} {Number(record.price).toFixed(2)}</small>}</div><div className="business-record-actions"><button className="quiet-button" type="button" onClick={() => openForm(record.kind, record)}>Edit</button><button className="quiet-button" type="button" onClick={() => void runAction(() => record.kind === "product" ? setProductStatus(userId, record.id, record.status === "published" ? "draft" : "published") : setServiceStatus(userId, record.id, record.status === "published" ? "draft" : "published"), record.status === "published" ? "Listing unpublished." : "Listing published.")}>{record.status === "published" ? "Unpublish" : "Publish"}</button><button className="business-danger" type="button" onClick={() => askDelete(record.kind, () => record.kind === "product" ? deleteProduct(userId, record.id) : deleteService(userId, record.id))}>Delete</button></div></article>)}</div> : <div className="business-state">You have no products or services yet.</div>}
    </section>
  </>;
}
