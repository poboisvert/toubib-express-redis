export async function fetchItems() {
  try {
    console.log("Fetching items data...");
    const response = await fetch("http://localhost:8081/api/items/latest", {
      next: {
        revalidate: 2,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data fetch completed.");
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}
