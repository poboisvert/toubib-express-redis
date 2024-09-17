export async function fetchItems() {
  try {
    console.log("Fetching items data...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch("http://localhost:8081/api/items/latest", {
      method: "GET",
      next: {
        revalidate: 1,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data fetch completed after 1 seconds.");
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}
