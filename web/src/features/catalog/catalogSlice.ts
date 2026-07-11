import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CatalogState {
  selectedBrand: string[];
  selectedCategory: string;
  maxPrice: number;
  selectedWeight: string[];
  selectedBalance: string;
  selectedStiffness: string;
  searchQuery: string;
}

const initialState: CatalogState = {
  selectedBrand: [],
  selectedCategory: 'Tất cả',
  maxPrice: 6000000,
  selectedWeight: [],
  selectedBalance: 'Tất cả',
  selectedStiffness: 'Tất cả',
  searchQuery: ''
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    setSelectedBrand: (state, action: PayloadAction<string[]>) => {
      state.selectedBrand = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
    },
    setMaxPrice: (state, action: PayloadAction<number>) => {
      state.maxPrice = action.payload;
    },
    setSelectedWeight: (state, action: PayloadAction<string[]>) => {
      state.selectedWeight = action.payload;
    },
    setSelectedBalance: (state, action: PayloadAction<string>) => {
      state.selectedBalance = action.payload;
    },
    setSelectedStiffness: (state, action: PayloadAction<string>) => {
      state.selectedStiffness = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    resetCatalogFilters: state => {
      state.selectedBrand = [];
      state.selectedCategory = 'Tất cả';
      state.maxPrice = 6000000;
      state.selectedWeight = [];
      state.selectedBalance = 'Tất cả';
      state.selectedStiffness = 'Tất cả';
      state.searchQuery = '';
    }
  }
});

export const {
  setSelectedBrand,
  setSelectedCategory,
  setMaxPrice,
  setSelectedWeight,
  setSelectedBalance,
  setSelectedStiffness,
  setSearchQuery,
  resetCatalogFilters
} = catalogSlice.actions;

export default catalogSlice.reducer;
