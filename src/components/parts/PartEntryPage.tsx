import { useState, useEffect } from "react";
import { PartEntryForm } from "@/components/parts/PartEntryForm";
import { CreateKitForm } from "@/components/parts/CreateKitForm";
import { PartsList, Part } from "@/components/parts/PartsList";
import { KitsList, Kit } from "@/components/parts/KitsList";
import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { apiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type LeftTab = "part-entry" | "create-kit";
type RightTab = "parts-list" | "kits-list";

interface PartEntryPageProps {
  searchFilters: any;
  setSearchFilters: (filters: any) => void;
  itemsPage: number;
  setItemsPage: (page: number) => void;
  itemsPerPage: number;
  fetchItems: (page: number, limit: number, filters: any) => Promise<void>;
}

export const PartEntryPage = ({
  searchFilters,
  setSearchFilters,
  itemsPage,
  setItemsPage,
  itemsPerPage,
  fetchItems,
}: PartEntryPageProps) => {
  const [leftTab, setLeftTab] = useState<LeftTab>("part-entry");
  const [rightTab, setRightTab] = useState<RightTab>("parts-list");
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedMasterPartNo, setSelectedMasterPartNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [kitRefreshTrigger, setKitRefreshTrigger] = useState(0);

  // Fetch parts from API - only on initial load if no master part is selected
  useEffect(() => {
    // Don't fetch all parts if a master part is selected (family parts are shown instead)
    if (selectedMasterPartNo) {
      return;
    }

    const fetchParts = async () => {
      setLoading(true);
      try {
        // Optimized: Fetch initial batch (500 parts) for faster load
        // PartsList handles pagination client-side, so we don't need all parts at once
        const response = await apiClient.getParts({ limit: 500, page: 1 });
        const responseData = response.data as any;

        if (responseData && Array.isArray(responseData)) {
          // SWAPPED: partNo shows master_part_no, masterPartNo shows part_no (to match ItemsListView)
          const transformedParts: Part[] = responseData.map((p: any) => ({
            id: p.id,
            partNo: (p.master_part_no || "").trim(),
            brand: p.brand_name || p.brand || "-",
            uom: p.uom || "NOS",
            cost: p.cost ? parseFloat(p.cost) : null,
            price: p.price_a ? parseFloat(p.price_a) : null,
            stock: 0,
            masterPartNo: (p.part_no || "").trim(),
          }));
          setParts(transformedParts);
        }
      } catch (error: any) {
        console.error("Error fetching parts:", error);
        toast({
          title: "Error",
          description: error.error || "Failed to fetch parts",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchParts();
  }, [selectedMasterPartNo]);

  // NOTE: Parts fetching is now handled inline in onPartSelected callback
  // This useEffect only runs when no master part is selected to prevent overwriting family parts

  const handleSavePart = async (partData: any) => {
    try {
      setLoading(true);

      if (!partData.partNo || String(partData.partNo).trim() === "") {
        toast({
          title: "Validation Error",
          description: "Part number is required",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // SWAPPED mapping to match ItemsListView display convention:
      // - "Master Part No" UI field saves to part_no column
      // - "Part No" UI field saves to master_part_no column
      const apiData: any = {
        part_no: String(partData.masterPartNo || "").trim(),
        master_part_no: String(partData.partNo).trim(),
        brand_name: partData.brand || null,
        description: partData.description || null,
        category_id: partData.categoryId || partData.category || null,
        subcategory_id: partData.subCategoryId || partData.subCategory || null,
        application_id: partData.applicationId || partData.application || null,
        hs_code: partData.hsCode || null,
        weight: partData.weight ? parseFloat(partData.weight) : null,
        reorder_level: partData.reOrderLevel ? parseInt(partData.reOrderLevel) : 0,
        uom: partData.uom || "pcs",
        cost: partData.cost ? parseFloat(partData.cost) : null,
        price_a: partData.priceA ? parseFloat(partData.priceA) : null,
        price_b: partData.priceB ? parseFloat(partData.priceB) : null,
        price_m: partData.priceM ? parseFloat(partData.priceM) : null,
        smc: partData.smc || null,
        size: partData.size || null,
        origin: partData.origin && partData.origin.trim() ? partData.origin.trim() : null,
        status: partData.status === "A" ? "active" : "inactive",
        models:
          partData.modelQuantities
            ?.filter((mq: any) => mq && mq.model && String(mq.model).trim() !== "")
            .map((mq: any) => ({
              name: String(mq.model).trim(),
              qty_used: mq.qty || 1,
            })) || [],
      };

      // Handle images
      if (selectedPart) {
        apiData.image_p1 = partData.imageP1 !== undefined ? partData.imageP1 : null;
        apiData.image_p2 = partData.imageP2 !== undefined ? partData.imageP2 : null;
      } else {
        if (partData.imageP1) apiData.image_p1 = partData.imageP1;
        if (partData.imageP2) apiData.image_p2 = partData.imageP2;
      }

      let response;
      if (selectedPart) {
        response = await apiClient.updatePart(selectedPart.id, apiData);
      } else {
        response = await apiClient.createPart(apiData);
      }

      if (response.error) throw new Error(response.error);

      const savedPart = response.data || response;

      // SWAPPED: partNo shows master_part_no, masterPartNo shows part_no (to match ItemsListView)
      const newPart: Part = {
        id: savedPart.id,
        partNo: (savedPart.master_part_no || "").trim(),
        masterPartNo: (savedPart.part_no || "").trim(),
        brand: savedPart.brand_name || savedPart.brand || "-",
        uom: savedPart.uom || "NOS",
        cost: savedPart.cost ? parseFloat(savedPart.cost) : null,
        price: savedPart.price_a ? parseFloat(savedPart.price_a) : null,
        stock: 0,
      };

      if (selectedPart) {
        setParts((prev) => prev.map((p) => (p.id === selectedPart.id ? newPart : p)));
        setSelectedPart(null);
      } else {
        setParts((prev) => [newPart, ...prev]);
      }

      console.log("🔄 Refreshing items after save with filters:", searchFilters);
      await fetchItems(itemsPage, itemsPerPage, searchFilters);

      toast({
        title: "Success",
        description: selectedPart ? "Part updated successfully" : "Part created successfully",
      });
    } catch (error: any) {
      console.error("Error saving part:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save part",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKit = (kitData: any) => {
    setKitRefreshTrigger((prev) => prev + 1);
  };

  const handleDeleteKit = (kit: Kit) => {
    setKitRefreshTrigger((prev) => prev + 1);
  };

  const handleUpdateKit = (updatedKit: Kit) => {
    setKitRefreshTrigger((prev) => prev + 1);
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg">
      {/* Left Section - Forms */}
      <ResizablePanel defaultSize={60} minSize={20} maxSize={80}>
        <div className="h-full flex flex-col pr-3">
          {/* Left Tabs */}
          <div className="flex border-b border-border mb-3">
            <button
              onClick={() => {
                setLeftTab("part-entry");
                setRightTab("parts-list");
              }}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-all relative",
                leftTab === "part-entry"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Part Entry
              {leftTab === "part-entry" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => {
                setLeftTab("create-kit");
                setRightTab("kits-list");
              }}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-all relative",
                leftTab === "create-kit"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Create Kit
              {leftTab === "create-kit" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-auto">
            {leftTab === "part-entry" ? (
              <PartEntryForm
                onSave={handleSavePart}
                selectedPart={selectedPart}
                onClearSelection={() => {
                  setSelectedPart(null);
                  setSelectedMasterPartNo(null);

                  setSearchFilters((prev: any) => ({
                    ...prev,
                    master_part_no: "",
                    part_no: "",
                  }));

                  // Optimized: Fetch with smaller initial limit for faster response
                  // The PartsList component handles pagination client-side, so we don't need all parts at once
                  const fetchAllParts = async () => {
                    setLoading(true);
                    try {
                      // Fetch initial batch (500 parts) for faster response
                      // User can search/filter to see more if needed
                      const response = await apiClient.getParts({ limit: 500, page: 1 });
                      const responseData = response.data as any;
                      if (responseData && Array.isArray(responseData)) {
                        // SWAPPED: partNo shows master_part_no, masterPartNo shows part_no
                        const transformedParts: Part[] = responseData.map((p: any) => ({
                          id: p.id,
                          partNo: (p.master_part_no || "").trim(),
                          brand: p.brand_name || p.brand || "-",
                          uom: p.uom || "NOS",
                          cost: p.cost ? parseFloat(p.cost) : null,
                          price: p.price_a ? parseFloat(p.price_a) : null,
                          stock: 0,
                          masterPartNo: (p.part_no || "").trim(),
                        }));
                        setParts(transformedParts);
                      }
                    } catch (error: any) {
                      console.error("Error fetching all parts:", error);
                    } finally {
                      setLoading(false);
                    }
                  };
                  fetchAllParts();
                }}
                onPartSelected={(valueFromDropdown: string) => {
                  // SWAPPED: "Master Part No" dropdown passes part_no values, so filter by part_no
                  setSelectedMasterPartNo(valueFromDropdown || null);

                  if (valueFromDropdown) {
                    const newFilters = {
                      ...searchFilters,
                      part_no: valueFromDropdown.trim(),
                      master_part_no: "",
                    };
                    setSearchFilters(newFilters);
                    setItemsPage(1);
                    fetchItems(1, itemsPerPage, newFilters);

                    const fetchPartsByMasterPart = async () => {
                      setLoading(true);
                      try {
                        console.log("🔍 Fetching family parts for Master Part No:", valueFromDropdown.trim());
                        // First try with part_no parameter
                        let response = await apiClient.getParts({
                          part_no: valueFromDropdown.trim(),
                          limit: 10000,
                        });

                        let partsData: any[] = [];
                        let responseData = response.data as any;

                        if (responseData) {
                          if (responseData.data && Array.isArray(responseData.data)) {
                            partsData = responseData.data;
                          } else if (Array.isArray(responseData)) {
                            partsData = responseData;
                          }
                        } else if (Array.isArray(response)) {
                          partsData = response;
                        }

                        // If no results with part_no, try search and filter client-side
                        if (partsData.length === 0) {
                          console.log("🔄 Trying search parameter...");
                          response = await apiClient.getParts({
                            search: valueFromDropdown.trim(),
                            limit: 10000,
                          });
                          
                          responseData = response.data as any;
                          if (responseData) {
                            if (responseData.data && Array.isArray(responseData.data)) {
                              partsData = responseData.data;
                            } else if (Array.isArray(responseData)) {
                              partsData = responseData;
                            }
                          } else if (Array.isArray(response)) {
                            partsData = response;
                          }
                          
                          // Filter client-side for exact match
                          const searchValue = valueFromDropdown.trim().toLowerCase();
                          partsData = partsData.filter((p: any) => 
                            (p.part_no || "").trim().toLowerCase() === searchValue
                          );
                        }

                        console.log(`📋 Found ${partsData.length} family parts for "${valueFromDropdown}"`);

                        if (partsData.length > 0) {
                          // SWAPPED: partNo shows master_part_no, masterPartNo shows part_no
                          const transformedParts: Part[] = partsData.map((p: any) => ({
                            id: p.id,
                            partNo: (p.master_part_no || "").trim(),
                            brand: p.brand_name || p.brand || "-",
                            uom: p.uom || "NOS",
                            cost: p.cost ? parseFloat(p.cost) : null,
                            price: p.price_a || p.priceA ? parseFloat(p.price_a || p.priceA) : null,
                            stock: 0,
                            masterPartNo: (p.part_no || "").trim(),
                          }));
                          console.log(`✅ Family parts:`, transformedParts.map((p) => p.partNo));
                          setParts(transformedParts);
                        } else {
                          console.log("⚠️ No family parts found for:", valueFromDropdown);
                          setParts([]);
                        }
                      } catch (error: any) {
                        console.error("Error fetching parts:", error);
                        setParts([]);
                      } finally {
                        setLoading(false);
                      }
                    };

                    fetchPartsByMasterPart();
                  }
                }}
                onPartNoSelected={(valueFromDropdown: string) => {
                  // When Part No is selected, keep showing ALL family parts (don't filter to single part)
                  // The Parts List should continue showing the whole family based on Master Part No
                  if (valueFromDropdown && selectedMasterPartNo) {
                    // Keep the filter by Master Part No (part_no column) to show whole family
                    const newFilters = {
                      ...searchFilters,
                      part_no: selectedMasterPartNo.trim(),
                      master_part_no: "",
                    };
                    setSearchFilters(newFilters);
                    setItemsPage(1);
                    fetchItems(1, itemsPerPage, newFilters);
                    // Don't change the Parts List - keep showing all family parts
                  } else if (valueFromDropdown && !selectedMasterPartNo) {
                    // No Master Part selected, filter by the Part No's family
                    const fetchFamilyByPartNo = async () => {
                      setLoading(true);
                      try {
                        // First get the part to find its Master Part No (part_no)
                        const response = await apiClient.getParts({
                          master_part_no: valueFromDropdown.trim(),
                          limit: 1,
                        });

                        let partsData: any[] = [];
                        const responseData = response.data as any;

                        if (responseData) {
                          if (responseData.data && Array.isArray(responseData.data)) {
                            partsData = responseData.data;
                          } else if (Array.isArray(responseData)) {
                            partsData = responseData;
                          }
                        } else if (Array.isArray(response)) {
                          partsData = response;
                        }

                        if (partsData.length > 0) {
                          const masterPartNo = (partsData[0].part_no || "").trim();
                          if (masterPartNo) {
                            // Now fetch all parts in this family
                            const familyResponse = await apiClient.getParts({
                              part_no: masterPartNo,
                              limit: 10000,
                            });

                            let familyData: any[] = [];
                            const familyResponseData = familyResponse.data as any;

                            if (familyResponseData) {
                              if (familyResponseData.data && Array.isArray(familyResponseData.data)) {
                                familyData = familyResponseData.data;
                              } else if (Array.isArray(familyResponseData)) {
                                familyData = familyResponseData;
                              }
                            } else if (Array.isArray(familyResponse)) {
                              familyData = familyResponse;
                            }

                            if (familyData.length > 0) {
                              // SWAPPED: partNo shows master_part_no, masterPartNo shows part_no
                              const transformedParts: Part[] = familyData.map((p: any) => ({
                                id: p.id,
                                partNo: (p.master_part_no || "").trim(),
                                brand: p.brand_name || p.brand || "-",
                                uom: p.uom || "NOS",
                                cost: p.cost ? parseFloat(p.cost) : null,
                                price: p.price_a || p.priceA ? parseFloat(p.price_a || p.priceA) : null,
                                stock: 0,
                                masterPartNo: (p.part_no || "").trim(),
                              }));
                              console.log(`✅ Showing ${transformedParts.length} family parts`);
                              setParts(transformedParts);
                              setSelectedMasterPartNo(masterPartNo);
                            }
                          }
                        }
                      } catch (error: any) {
                        console.error("Error fetching family parts:", error);
                      } finally {
                        setLoading(false);
                      }
                    };

                    fetchFamilyByPartNo();
                  } else {
                    const newFilters = {
                      ...searchFilters,
                      part_no: "",
                    };
                    setSearchFilters(newFilters);
                    setItemsPage(1);
                    fetchItems(1, itemsPerPage, newFilters);

                    const fetchAllParts = async () => {
                      setLoading(true);
                      try {
                        const response = await apiClient.getParts({ limit: 10000 });
                        const responseData = response.data as any;
                        if (responseData && Array.isArray(responseData)) {
                          // SWAPPED: partNo shows master_part_no, masterPartNo shows part_no
                          const transformedParts: Part[] = responseData.map((p: any) => ({
                            id: p.id,
                            partNo: (p.master_part_no || "").trim(),
                            brand: p.brand_name || p.brand || "-",
                            uom: p.uom || "NOS",
                            cost: p.cost ? parseFloat(p.cost) : null,
                            price: p.price_a ? parseFloat(p.price_a) : null,
                            stock: 0,
                            masterPartNo: (p.part_no || "").trim(),
                          }));
                          setParts(transformedParts);
                        }
                      } catch (error: any) {
                        console.error("Error fetching all parts:", error);
                      } finally {
                        setLoading(false);
                      }
                    };

                    fetchAllParts();
                  }
                }}
              />
            ) : (
              <CreateKitForm onSave={handleSaveKit} />
            )}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle
        withHandle
        className="mx-1 bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary"
      />

      {/* Right Section - Lists */}
      <ResizablePanel defaultSize={40} minSize={20} maxSize={80}>
        <div className="h-full flex flex-col pl-3">
          {/* Right Tabs */}
          <div className="flex border-b border-border mb-3">
            <button
              onClick={() => setRightTab("parts-list")}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-all relative flex-1 text-center",
                rightTab === "parts-list"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Parts List
              {rightTab === "parts-list" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setRightTab("kits-list")}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-all relative flex-1 text-center",
                rightTab === "kits-list"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Kits List
              {rightTab === "kits-list" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === "parts-list" ? (
              <PartsList
                parts={parts}
                onSelectPart={async (part) => {
                  setSelectedPart(part);
                  setLeftTab("part-entry");
                  
                  // Fetch family parts when a part is selected from the list
                  if (part.masterPartNo) {
                    setSelectedMasterPartNo(part.masterPartNo);
                    setLoading(true);
                    try {
                      // Fetch all parts in this family
                      let response = await apiClient.getParts({
                        part_no: part.masterPartNo.trim(),
                        limit: 10000,
                      });

                      let partsData: any[] = [];
                      let responseData = response.data as any;

                      if (responseData) {
                        if (responseData.data && Array.isArray(responseData.data)) {
                          partsData = responseData.data;
                        } else if (Array.isArray(responseData)) {
                          partsData = responseData;
                        }
                      } else if (Array.isArray(response)) {
                        partsData = response;
                      }

                      // If no results with part_no, try search
                      if (partsData.length === 0) {
                        response = await apiClient.getParts({
                          search: part.masterPartNo.trim(),
                          limit: 10000,
                        });
                        
                        responseData = response.data as any;
                        if (responseData) {
                          if (responseData.data && Array.isArray(responseData.data)) {
                            partsData = responseData.data;
                          } else if (Array.isArray(responseData)) {
                            partsData = responseData;
                          }
                        } else if (Array.isArray(response)) {
                          partsData = response;
                        }
                        
                        // Filter client-side
                        const searchValue = part.masterPartNo.trim().toLowerCase();
                        partsData = partsData.filter((p: any) => 
                          (p.part_no || "").trim().toLowerCase() === searchValue
                        );
                      }

                      if (partsData.length > 0) {
                        const transformedParts: Part[] = partsData.map((p: any) => ({
                          id: p.id,
                          partNo: (p.master_part_no || "").trim(),
                          brand: p.brand_name || p.brand || "-",
                          uom: p.uom || "NOS",
                          cost: p.cost ? parseFloat(p.cost) : null,
                          price: p.price_a || p.priceA ? parseFloat(p.price_a || p.priceA) : null,
                          stock: 0,
                          masterPartNo: (p.part_no || "").trim(),
                        }));
                        console.log(`✅ Family parts for "${part.masterPartNo}":`, transformedParts.map((p) => p.partNo));
                        setParts(transformedParts);
                      }
                    } catch (error: any) {
                      console.error("Error fetching family parts:", error);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
              />
            ) : (
              <KitsList
                refreshTrigger={kitRefreshTrigger}
                onDelete={handleDeleteKit}
                onUpdateKit={handleUpdateKit}
              />
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
