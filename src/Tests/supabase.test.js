const supabase = require("../config/supabase");

(async () => {
  const { data, error } = await supabase.from("usuario").select("*");
  console.log("Usuarios:", data);
  console.error("Error:", error);
})();