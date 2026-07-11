import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { sportApi } from '../../services/sportApi';
import { Blog, Branch, Category, Product, StringOption } from '../../types';

export interface AppDataState {
  products: Product[];
  blogs: Blog[];
  branches: Branch[];
  stringOptions: StringOption[];
  categories: Category[];
  isLoading: boolean;
}

const initialState: AppDataState = {
  products: [],
  blogs: [],
  branches: [],
  stringOptions: [],
  categories: [],
  isLoading: true
};

export const fetchAppData = createAsyncThunk('appData/fetchAppData', async () => {
  const [products, blogs, branches, stringOptions, categories] = await Promise.all([
    sportApi.getProducts(),
    sportApi.getBlogs(),
    sportApi.getBranches(),
    sportApi.getStringOptions(),
    sportApi.getCategories()
  ]);

  return { products, blogs, branches, stringOptions, categories };
});

const appDataSlice = createSlice({
  name: 'appData',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchAppData.pending, state => {
        state.isLoading = true;
      })
      .addCase(fetchAppData.fulfilled, (state, action) => {
        state.products = action.payload.products;
        state.blogs = action.payload.blogs;
        state.branches = action.payload.branches;
        state.stringOptions = action.payload.stringOptions;
        state.categories = action.payload.categories;
        state.isLoading = false;
      })
      .addCase(fetchAppData.rejected, state => {
        state.isLoading = false;
      });
  }
});

export default appDataSlice.reducer;
