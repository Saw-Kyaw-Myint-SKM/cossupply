<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreCategoryRequest extends FormRequest
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
        return [
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name_mm' => ['required', 'string', 'max:255'],
            'name_en' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:categories,slug'],
            'description' => ['nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', Rule::in(Category::STATUSES)],
        ];
    }

    /**
     * Validate the slug that will be generated from name_en when omitted.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('slug') || $validator->errors()->has('name_en')) {
                    return;
                }

                $derived = Str::slug((string) $this->input('name_en'));

                if ($derived === '') {
                    $validator->errors()->add('slug', 'The slug field is required because a slug cannot be generated from name_en.');

                    return;
                }

                if (Category::query()->where('slug', $derived)->exists()) {
                    $validator->errors()->add('slug', 'The slug has already been taken.');
                }
            },
        ];
    }
}
