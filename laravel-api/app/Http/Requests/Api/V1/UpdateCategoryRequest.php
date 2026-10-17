<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateCategoryRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + admin middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $category = $this->route('category');

        return [
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'name_mm' => ['sometimes', 'required', 'string', 'max:255'],
            'name_en' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('categories', 'slug')->ignore($category?->id),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'image' => ['sometimes', 'nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in(Category::STATUSES)],
        ];
    }

    /**
     * Validate that a category cannot become its own parent.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $category = $this->route('category');

                if (! $category instanceof Category || $validator->errors()->has('parent_id')) {
                    return;
                }

                if ($this->input('parent_id') !== null && (int) $this->input('parent_id') === $category->id) {
                    $validator->errors()->add('parent_id', 'A category cannot be its own parent.');
                }
            },
        ];
    }
}
