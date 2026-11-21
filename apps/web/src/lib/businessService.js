import { supabase } from "./supabase";
import { validateBusiness, validateProduct, validateService } from "./businessValidation";

function requireUser(userId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!userId) throw new Error("Your account session is unavailable. Please sign in again.");
}

function throwIfError(error) {
  if (error) throw error;
}

export async function listBusinesses(userId) {
  requireUser(userId);
  const { data, error } = await supabase
    .from("businesses")
    .select("id, owner_id, name, description, website_url, country_code, status, created_at")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data || []).filter((business) => business.status === "published" || business.owner_id === userId);
}

export async function listPublishedCatalog(userId) {
  requireUser(userId);
  const [productsResult, servicesResult] = await Promise.all([
    supabase.from("products").select("id, owner_id, title, description, price, currency, category, product_url, status, created_at").eq("status", "published").order("created_at", { ascending: false }),
    supabase.from("services").select("id, owner_id, title, description, category, portfolio_url, contact_url, status, created_at").eq("status", "published").order("created_at", { ascending: false })
  ]);
  throwIfError(productsResult.error);
  throwIfError(servicesResult.error);
  return {
    products: productsResult.data || [],
    services: servicesResult.data || []
  };
}

export async function createBusiness(userId, values) {
  requireUser(userId);
  const { data, error } = await supabase
    .from("businesses")
    .insert({ ...validateBusiness(values), owner_id: userId, status: "draft" })
    .select("id, owner_id, name, description, website_url, country_code, status, created_at")
    .single();
  throwIfError(error);
  return data;
}

export async function updateBusiness(userId, businessId, values) {
  requireUser(userId);
  const { data, error } = await supabase
    .from("businesses")
    .update(validateBusiness(values))
    .eq("id", businessId)
    .eq("owner_id", userId)
    .select("id, owner_id, name, description, website_url, country_code, status, created_at")
    .single();
  throwIfError(error);
  return data;
}

export async function setBusinessStatus(userId, businessId, status) {
  requireUser(userId);
  if (!['draft', 'published'].includes(status)) throw new Error("Unsupported business status.");
  const { data, error } = await supabase
    .from("businesses")
    .update({ status })
    .eq("id", businessId)
    .eq("owner_id", userId)
    .select("id, owner_id, name, description, website_url, country_code, status, created_at")
    .single();
  throwIfError(error);
  return data;
}

export async function deleteBusiness(userId, businessId) {
  requireUser(userId);
  const { data, error } = await supabase
    .from("businesses")
    .delete()
    .eq("id", businessId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Business not found or you do not have permission to delete it.");
}

export async function listMyCatalog(userId) {
  requireUser(userId);
  const [productsResult, servicesResult] = await Promise.all([
    supabase.from("products").select("id, owner_id, title, description, price, currency, category, product_url, status, created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, owner_id, title, description, category, portfolio_url, contact_url, status, created_at").eq("owner_id", userId).order("created_at", { ascending: false })
  ]);
  throwIfError(productsResult.error);
  throwIfError(servicesResult.error);
  return { products: productsResult.data || [], services: servicesResult.data || [] };
}

export async function saveProduct(userId, productId, values) {
  requireUser(userId);
  const payload = validateProduct(values);
  const query = productId
    ? supabase.from("products").update(payload).eq("id", productId).eq("owner_id", userId)
    : supabase.from("products").insert({ ...payload, owner_id: userId, status: "draft" });
  const { data, error } = await query.select("id, owner_id, title, description, price, currency, category, product_url, status, created_at").single();
  throwIfError(error);
  return data;
}

export async function setProductStatus(userId, productId, status) {
  requireUser(userId);
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error("Unsupported product status.");
  const { data, error } = await supabase.from("products").update({ status }).eq("id", productId).eq("owner_id", userId)
    .select("id, owner_id, title, description, price, currency, category, product_url, status, created_at").single();
  throwIfError(error);
  return data;
}

export async function deleteProduct(userId, productId) {
  requireUser(userId);
  const { data, error } = await supabase.from("products").delete().eq("id", productId).eq("owner_id", userId).select("id").maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Product not found or you do not have permission to delete it.");
}

export async function saveService(userId, serviceId, values) {
  requireUser(userId);
  const payload = validateService(values);
  const query = serviceId
    ? supabase.from("services").update(payload).eq("id", serviceId).eq("owner_id", userId)
    : supabase.from("services").insert({ ...payload, owner_id: userId, status: "draft" });
  const { data, error } = await query.select("id, owner_id, title, description, category, portfolio_url, contact_url, status, created_at").single();
  throwIfError(error);
  return data;
}

export async function setServiceStatus(userId, serviceId, status) {
  requireUser(userId);
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error("Unsupported service status.");
  const { data, error } = await supabase.from("services").update({ status }).eq("id", serviceId).eq("owner_id", userId)
    .select("id, owner_id, title, description, category, portfolio_url, contact_url, status, created_at").single();
  throwIfError(error);
  return data;
}

export async function deleteService(userId, serviceId) {
  requireUser(userId);
  const { data, error } = await supabase.from("services").delete().eq("id", serviceId).eq("owner_id", userId).select("id").maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Service not found or you do not have permission to delete it.");
}
