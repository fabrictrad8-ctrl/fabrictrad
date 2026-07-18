'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface Subcategory {
  id: string;
  name: string;
  productCount: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: Subcategory[];
  expanded: boolean;
}

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    name: 'Fabric',
    icon: '🧵',
    expanded: true,
    subcategories: [
      { id: 'sub-1', name: 'Pure Silk', productCount: 12 },
      { id: 'sub-2', name: 'Cotton & Linen', productCount: 8 },
      { id: 'sub-3', name: 'Net & Netting', productCount: 15 },
      { id: 'sub-4', name: 'Georgette', productCount: 6 },
      { id: 'sub-5', name: 'Embroidered', productCount: 9 },
    ],
  },
  {
    id: 'cat-2',
    name: 'Farma',
    icon: '🌿',
    expanded: false,
    subcategories: [
      { id: 'sub-6', name: 'Natural Dyes', productCount: 4 },
      { id: 'sub-7', name: 'Organic Cotton', productCount: 3 },
    ],
  },
];

export default function SellerCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦');
  const [addingSubcatFor, setAddingSubcatFor] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const ICON_OPTIONS = ['🧵', '🌿', '👗', '🎨', '📦', '💎', '🌸', '🏭', '🧶', '✂️'];

  const toggleExpand = (catId: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, expanded: !c.expanded } : c))
    );
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      expanded: true,
      subcategories: [],
    };
    setCategories((prev) => [...prev, newCat]);
    setNewCategoryName('');
    setNewCategoryIcon('📦');
    setShowAddCategory(false);
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleAddSubcategory = (catId: string) => {
    if (!newSubcatName.trim()) return;
    const newSub: Subcategory = {
      id: `sub-${Date.now()}`,
      name: newSubcatName.trim(),
      productCount: 0,
    };
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: [...c.subcategories, newSub] }
          : c
      )
    );
    setNewSubcatName('');
    setAddingSubcatFor(null);
  };

  const handleDeleteSubcategory = (catId: string, subId: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) }
          : c
      )
    );
  };

  const handleSaveEditCategory = (catId: string) => {
    if (!editingCatName.trim()) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, name: editingCatName.trim() } : c))
    );
    setEditingCatId(null);
    setEditingCatName('');
  };

  const totalProducts = categories.reduce(
    (sum, c) => sum + c.subcategories.reduce((s, sub) => s + sub.productCount, 0),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} categories · {totalProducts} products
          </p>
        </div>
        <button
          onClick={() => setShowAddCategory(true)}
          className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"
        >
          <Icon name="PlusIcon" size={16} />
          Add Category
        </button>
      </div>

      {/* Add Category Form */}
      {showAddCategory && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-700 text-foreground mb-3">New Category</h3>
          <div className="flex items-center gap-3 mb-3">
            <div>
              <p className="text-xs font-600 text-muted-foreground mb-1.5">Icon</p>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewCategoryIcon(icon)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border transition-all ${
                      newCategoryIcon === icon
                        ? 'border-primary bg-primary/10' :'border-border bg-muted hover:border-primary/50'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name (e.g. Fabric, Farma, Accessories)"
              className="input-base flex-1 px-3 py-2.5 text-sm rounded-xl"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button onClick={handleAddCategory} className="btn-primary px-4 py-2.5 text-sm rounded-xl">
              Add
            </button>
            <button onClick={() => setShowAddCategory(false)} className="btn-secondary px-4 py-2.5 text-sm rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category List */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center gap-3 p-4">
              <button
                onClick={() => toggleExpand(cat.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <span className="text-xl">{cat.icon}</span>
                {editingCatId === cat.id ? (
                  <input
                    type="text"
                    value={editingCatName}
                    onChange={(e) => setEditingCatName(e.target.value)}
                    className="input-base px-2 py-1 text-sm rounded-lg flex-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEditCategory(cat.id);
                      if (e.key === 'Escape') setEditingCatId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <div className="flex-1">
                    <p className="font-700 text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.subcategories.length} subcategories ·{' '}
                      {cat.subcategories.reduce((s, sub) => s + sub.productCount, 0)} products
                    </p>
                  </div>
                )}
                <Icon
                  name={cat.expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                  size={16}
                  className="text-muted-foreground shrink-0"
                />
              </button>
              <div className="flex items-center gap-1">
                {editingCatId === cat.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEditCategory(cat.id)}
                      className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                    >
                      <Icon name="CheckIcon" size={14} />
                    </button>
                    <button
                      onClick={() => setEditingCatId(null)}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    >
                      <Icon name="PencilSquareIcon" size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 rounded-lg hover:bg-error/10 transition-colors text-muted-foreground hover:text-error"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Subcategories */}
            {cat.expanded && (
              <div className="border-t border-border">
                {cat.subcategories.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 ml-6 shrink-0" />
                    <span className="text-sm text-foreground flex-1">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">{sub.productCount} products</span>
                    <button
                      onClick={() => handleDeleteSubcategory(cat.id, sub.id)}
                      className="p-1 rounded-lg hover:bg-error/10 transition-colors text-muted-foreground hover:text-error"
                    >
                      <Icon name="XMarkIcon" size={13} />
                    </button>
                  </div>
                ))}

                {/* Add Subcategory */}
                {addingSubcatFor === cat.id ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary ml-6 shrink-0" />
                    <input
                      type="text"
                      value={newSubcatName}
                      onChange={(e) => setNewSubcatName(e.target.value)}
                      placeholder="Subcategory name..."
                      className="input-base flex-1 px-3 py-1.5 text-sm rounded-lg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddSubcategory(cat.id);
                        if (e.key === 'Escape') setAddingSubcatFor(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddSubcategory(cat.id)}
                      className="btn-primary px-3 py-1.5 text-xs rounded-lg"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setAddingSubcatFor(null)}
                      className="btn-secondary px-3 py-1.5 text-xs rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingSubcatFor(cat.id); setNewSubcatName(''); }}
                    className="flex items-center gap-2 px-4 py-2.5 w-full text-left hover:bg-muted/30 transition-colors text-xs text-primary font-600"
                  >
                    <Icon name="PlusIcon" size={13} />
                    <span className="ml-6">Add Subcategory</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Icon name="TagIcon" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-700 text-foreground mb-1">No categories yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create your first product category to organise your inventory</p>
          <button onClick={() => setShowAddCategory(true)} className="btn-primary px-4 py-2 text-sm rounded-xl">
            Add First Category
          </button>
        </div>
      )}
    </div>
  );
}
